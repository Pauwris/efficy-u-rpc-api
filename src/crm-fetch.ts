import { CrmEnv } from "./crm-env.js";
import { isJsonApiErrorNode, isJsonApiResponse } from "./dataguards.js";
import { CrmFetchErroreInterceptorFunction, CrmFetchRequestInterceptorFunction, CrmFetchResponseInterceptorFunction, JsonApiErrorNode, QueryStringArgs } from "./types.js";

// Base interceptor class with generic type for interceptor function
// eslint-disable-next-line @typescript-eslint/ban-types
abstract class CrmFetchInterceptor<T extends Function> {
	private funcs: T[] = [];

	// Abstract method to define specific interceptor behavior (request or response)
	protected abstract handle(data: any): Promise<void>;

	// Generic use method to add interceptors
	use(func: T): void {
		this.funcs.push(func);
	}

	// Generic clear method to remove all interceptors
	clear(): void {
		this.funcs.length = 0;
	}

	// Generic get interceptors method
	get interceptors(): ReadonlyArray<T> {
		return [...this.funcs]; // Create a copy to prevent mutation
	}

	// Internal method to chain interceptors for request or response handling
	protected async chain(data: any): Promise<void> {
		for (const func of this.funcs) {
			await func(data);
		}
	}
}

export class CrmFetchRequestInterceptor extends CrmFetchInterceptor<CrmFetchRequestInterceptorFunction> {
	async handle(request: Request): Promise<void> {
		await this.chain(request);
	}
}
export class CrmFetchResponseInterceptor extends CrmFetchInterceptor<CrmFetchResponseInterceptorFunction> {
	async handle(response: Response): Promise<void> {
		await this.chain(response);
	}
}
export class CrmFetchErrorInterceptor extends CrmFetchInterceptor<CrmFetchErroreInterceptorFunction> {
	async handle(e: Error): Promise<void> {
		await this.chain(e);
	}
}

export class CrmFetch {
	protected name = "CrmFetch";
	protected sessionId?: string;
	protected requestCounter: number = 0;
	private _lastResponseObject: object | null = null;

	constructor(public crmEnv = new CrmEnv()) {
		this.setFetchOptions();
	}

	fetchOptions: RequestInit = {
		method: "POST",
		headers: {
			'Accept': 'application/json'
		},
		credentials: 'include' // Always send user credentials (cookies, basic http auth, etc..), even for cross-origin calls.
	}

	get lastResponseObject() {
		return this._lastResponseObject;
	}

	protected setFetchOptions() {
		const headers: Record<string, any> = { ...this.fetchOptions.headers };

		if (this.crmEnv.apiKey) {
			headers["X-Efficy-ApiKey"] = this.crmEnv.apiKey;
		} else if (this.crmEnv.user && this.crmEnv.pwd) {
			headers["X-Efficy-User"] = this.crmEnv.user;
			headers["X-Efficy-Pwd"] = this.crmEnv.pwd;
		}
		if (this.crmEnv.logOff) {
			headers["X-Efficy-Logoff"] = true;
		}

		if (this.crmEnv.useFetchQueue) {
			FetchQueue.forceSequential = true;
		}

		this.fetchOptions.headers = headers;
	}

	protected initJsonFetch(method: "GET" | "POST") {
		const requestHeaders: HeadersInit = new Headers(this.fetchOptions.headers);
		requestHeaders.set('Content-Type', 'application/json');
		this.fetchOptions.headers = requestHeaders;
		this.fetchOptions.method = method;
	}

	protected async fetch(requestUrl: string, requestOptions?: RequestInit, isRetry: boolean = false): Promise<object> {
		let response: Response | null = null;
		let responseBody: string = "";
		let responseObject: object = {};
		let responseStatusCode: number = 0;

		const init: RequestInit = {};
		Object.assign(init, this.fetchOptions, requestOptions);

		if (this.crmEnv.cookieHeader) {
			init.headers = {
				"Cookie": this.crmEnv.cookieHeader
			}
		}

		const request = new Request(requestUrl, init);
		await this.crmEnv.interceptors.onRequest.handle(request);

		const fetchQueue = new FetchQueue();
		try {
			await fetchQueue.waitMyTurn();
			response = await fetch(request);

			responseBody = await response.text();
			responseStatusCode = response.status;
			responseObject = JSON.parse(responseBody || "[]");
			this._lastResponseObject = responseObject;
		} finally {
			fetchQueue.finished();
		}

		const crmException = this.getCrmException(responseObject);

		const cookieString = response.headers.get('set-cookie');
		if (cookieString) {
			const cookie = parseEfficyCookieString(cookieString);
			this.crmEnv.cookies = [cookie];
			this.sessionId = this.crmEnv.shortSessionId;
		}


		// CFT-2024-354876
		const couldBeExpiredSession = (
			responseStatusCode === 401
			|| crmException?.message.includes("This operation requires a Database Connection")
			|| crmException?.message.includes("Invalid User")
			|| crmException?.message.includes("You do not have the right to perform this operation")
		)

		if (couldBeExpiredSession && this.crmEnv.retryWithNewSession && isRetry === false) {
			this.crmEnv.clearCookies();
			return this.fetch(requestUrl, requestOptions, true);
		}

		if (crmException) {
			await this.crmEnv.interceptors.onError.handle(crmException.error);
			throw new Error(crmException.toString());
		}

		if (response) {
			await this.crmEnv.interceptors.onPositiveResponse.handle(response);
		}

		return responseObject;
	}

	protected getRequestUrl(crmPath: string, queryArgs?: QueryStringArgs) {
		const searchParams = new URLSearchParams();

		if (queryArgs) {
			for (const [key, value] of Object.entries(queryArgs)) {
				searchParams.append(key, value.toString());
			}
		}

		// Useful for development environments
		if (this.crmEnv.customer) {
			searchParams.append("customer", this.crmEnv.customer);
		}

		const queryString = searchParams.toString();
		const requestUrl = `${this.crmEnv.url}/crm/${crmPath}?${queryString}`;

		return requestUrl;
	}

	/**
	 * Parse errors in both legacy Enterprise format as from the U {data, errors, status} format
	 * @param responseObject
	 */
	private getCrmException(responseObject: any): CrmException | undefined {
		const resp = responseObject;
		if (Array.isArray(resp)) {
			const errWrapper = resp.find(operation => operation["@name"] === "exception")
			if (errWrapper && errWrapper["#error"]) {
				const err = errWrapper["#error"];
				return new CrmException(err.message ?? err.errorstring, err.code ?? err.errorcode, err.detail);
			}
		} else if (Array.isArray(resp.errors) && resp.errors.length > 0) {
			const [err] = resp.errors;
			return new CrmException(err.detail, err.id, err.exta);
		} else if (typeof resp === "object" && typeof resp["#error"] === "object") {
			const err = resp["#error"];
			return new CrmException(err.message ?? err.errorstring, err.code ?? err.errorcode, err.detail);
		} else if (typeof resp === "object" && resp["error"] === true) {
			const err = resp;
			return new CrmException(err.message ?? err.errorstring, err.code ?? err.errorcode, err.detail);
		} else if (isJsonApiResponse(resp) && resp["errors"].length > 0 && isJsonApiErrorNode(resp["errors"][0])) {
			const [err] = resp["errors"];
			return CrmException.fromJsonApiErrorNode(err);
		}
	}
}

/**
 * Technical helper for forcing zero concurrency in fetch execution of CrmRpc and CrmApi.
 * @deprecated
 */
export class FetchQueue {
	#id = 0;
	#startTime = 0;

	static forceSequential = false;
	static waitTime = 10; // milliseconds
	static pending = false;
	static fetchCount = 0;
	static totalRequestTime = 0;
	static minRequestTime = Infinity;
	static maxRequestTime = 0;

	constructor() {
		FetchQueue.fetchCount++;
		this.#id = FetchQueue.fetchCount;
	}

	pleaseWait() {
		return (FetchQueue.pending === true)
	}
	takeTurn() {
		FetchQueue.pending = true;
		this.#startTime = Date.now();
	}
	finished() {
		const requestTime = Date.now() - this.#startTime;
		FetchQueue.totalRequestTime += requestTime;
		FetchQueue.minRequestTime = Math.min(FetchQueue.minRequestTime, requestTime);
		FetchQueue.maxRequestTime = Math.max(FetchQueue.maxRequestTime, requestTime);

		FetchQueue.pending = false;
	}

	async sleep() {
		await new Promise(r => setTimeout(r, FetchQueue.waitTime));
	}
	async waitMyTurn() {
		if (FetchQueue.forceSequential) {
			while (this.pleaseWait()) {
				await this.sleep();
			}
		}

		this.takeTurn();
	}

	static get averageRequestTime() {
		return FetchQueue.totalRequestTime / FetchQueue.fetchCount;
	}

	static get stats() {
		return {
			"fetchCount": FetchQueue.fetchCount,
			"averageRequestTime": FetchQueue.averageRequestTime,
			"totalRequestTime": FetchQueue.totalRequestTime,
			"maxRequestTime": FetchQueue.maxRequestTime,
			"minRequestTime": FetchQueue.minRequestTime
		}
	}
}

export class CrmException {
	constructor(public message: string, public code: string = "RPC", public detail: string = "") { }
	toString() {
		return [this.code, this.message, this.detail].join(" - ");
	}

	static fromJsonApiErrorNode(o: JsonApiErrorNode) {
		return new CrmException(o.title, o.id, o.detail)
	}

	get error(): Error {
		return new Error(this.toString())
	}
}

function parseEfficyCookieString(cookieStr: string) {
	const keyValuePairs = cookieStr.split(';');

	const name: string = "EfficySession";
	let value: string = "";
	let path: string = "";
	let expires: string = "";

	for (const pair of keyValuePairs) {
		const [key, _value] = pair.trim().split('=');
		if (key === "EfficySession") {
			value = decodeURIComponent(_value);
		}
		if (key === "path") {
			path = decodeURIComponent(_value);
		}
		if (key === "expires") {
			expires = decodeURIComponent(_value);
		}
	}

	return {
		name,
		value,
		path,
		expires
	};
}
