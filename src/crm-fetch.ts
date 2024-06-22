import { CrmEnv } from "./crm-env.js";
import { isJsonApiErrorNode, isJsonApiResponse } from "./dataguards.js";
import { JsonApiErrorNode, ModulePostPayload, QueryStringArgs } from "./types.js";

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

	protected async crmfetch(requestUrl: string, requestPayload?: ModulePostPayload, requestOptions?: RequestInit, isRetry: boolean = false): Promise<object> {
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
			if (this.crmEnv.useFetchQueue) await fetchQueue.waitMyTurn();
			response = await globalThis.fetch(request);
			responseBody = await response.text();
			responseStatusCode = response.status;
			responseObject = JSON.parse(responseBody || "[]");
			this._lastResponseObject = responseObject;
			if (!response.ok && response.status !== 401) {
				throw new Error(`Fetch request failed with status code: ${response.status}`)
			}
		} catch(e) {
			await this.crmEnv.interceptors.onError.handle(e, request, requestPayload, response);
			throw e;
		} finally {
			if (this.crmEnv.useFetchQueue) fetchQueue.finished();
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
			|| crmException?.message.includes("RetrieveUsersList: Please Logon to Database") // Enterprise only
		)

		if (couldBeExpiredSession && this.crmEnv.retryWithNewSession && isRetry === false) {
			this.crmEnv.clearCookies();
			return this.crmfetch(requestUrl, requestPayload, requestOptions, true);
		}

		if (crmException) {
			await this.crmEnv.interceptors.onError.handle(crmException.error, request, requestPayload, response);
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
		} else if (isJsonApiResponse(resp) && Array.isArray(resp["errors"]) && resp["errors"].length > 0 && isJsonApiErrorNode(resp["errors"][0])) {
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
