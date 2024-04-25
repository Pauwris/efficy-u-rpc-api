import { CrmEnv } from "./crm-env.js";
import { ErrorFunction, JsonApiErrorNode, JsonApiResponse, LogFunction } from "./types.js";

export class CrmFetch {
	protected name = "CrmFetch";
	protected sessionId?: string;
	protected requestCounter: number = 0;
	protected errorFunction?: ErrorFunction;
	private _lastResponseObject: object | null = null;

	constructor(public crmEnv = new CrmEnv(), public logFunction?: LogFunction, public threadId: number = 1) {
		this.setFetchOptions();
	}

	get lastResponseObject() {
		return this._lastResponseObject;
	}

	protected setFetchOptions() {
		try {
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
		} catch (ex: unknown) {
			if (ex instanceof Error) {
				this.throwError(`${this.name}.setFetchOptions::${ex.message}`)
			} else {
				console.error(ex);
			}
		}
	}

	protected throwError(rpcException: string | CrmException) {
		const errorMessage = typeof rpcException === "string" ? rpcException : rpcException.toString();
		if (typeof this.errorFunction === "function") {
			this.errorFunction(errorMessage);
		} else {
			throw Error(errorMessage);
		}
	}


	protected fetchOptions: RequestInit = {
		method: "POST",
		headers: {
			'Content-Type': 'application/json',
			'Accept': 'application/json'
		},
		credentials: 'include' // Always send user credentials (cookies, basic http auth, etc..), even for cross-origin calls.
	}

	protected async fetch(requestUrl: string, requestObject?: RequestInit): Promise<object> {
		let response: Response | null = null;
		let responseBody: string = "";
		let responseObject: object = {};
		let crmException: CrmException | undefined;

		try {
			const request: RequestInit = Object.assign(this.fetchOptions, { body: JSON.stringify(requestObject) });

			if (this.crmEnv.cookieHeader) {
				request.headers = {
					"Cookie": this.crmEnv.cookieHeader
				}
			}


			const fetchQueue = new FetchQueue();
			try {
				await fetchQueue.waitMyTurn();
				response = await fetch(requestUrl, request);

				try {
					responseBody = await response.text();
					responseObject = JSON.parse(responseBody || "[]");
					this._lastResponseObject = responseObject;
				} catch (ex) {
					if (ex instanceof SyntaxError) {
						console.error("Invalid JSON format: ", ex.message);
					} else {
						console.error("Unexpected error: ", ex);
					}
				}
			} finally {
				fetchQueue.finished();
			}

			crmException = this.getCrmException(responseObject);

			const cookieString = response.headers.get('set-cookie');
			if (cookieString) {
				const cookie = parseEfficyCookieString(cookieString);
				this.crmEnv.cookies = [cookie];
				this.sessionId = this.crmEnv.shortSessionId;
			}
		} catch (ex) {
			if (ex instanceof Error) {
				this.throwError(`${this.name}.fetch::${ex.message}`)
			} else {
				console.error(ex);
			}
		}

		if (crmException instanceof CrmException) {
			this.throwError(crmException);
		}

		return responseObject;
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
		} else if (this.isJsonApiResponse(resp) && resp["errors"].length > 0 && this.isJsonApiErrorNode(resp["errors"][0])) {
			const [err] = resp["errors"];
			return CrmException.fromJsonApiErrorNode(err);
		}
	}

	protected isJsonApiResponse(response: any): response is JsonApiResponse {
		return (
			typeof response === 'object' &&	response !== null && 
			typeof response.data === 'object' &&
			Array.isArray(response.errors) &&
			Array.isArray(response.status)
		);
	}
	protected isJsonApiErrorNode(err: any): err is JsonApiErrorNode {
		return (
			typeof err === 'object' && err !== null &&
			'detail' in err && typeof err.detail === 'string' &&
			'extra' in err && typeof err.extra === 'object' &&
			'id' in err && typeof err.id === 'string' &&
			'title' in err && typeof err.title === 'string'
		);
	}
}

/**
 * Technical helper for forcing zero concurrency in fetch execution of CrmRpc and CrmApi.
 * @deprecated
 */
export class FetchQueue {
	#id = 0;
	#startTime = 0;

	static debug = false;
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
		FetchQueue.debug && console.log(`takeTurn: ${this.#id}/${FetchQueue.fetchCount}`)
	}
	finished() {
		const requestTime = Date.now() - this.#startTime;
		FetchQueue.totalRequestTime += requestTime;
		FetchQueue.minRequestTime = Math.min(FetchQueue.minRequestTime, requestTime);
		FetchQueue.maxRequestTime = Math.max(FetchQueue.maxRequestTime, requestTime);

		FetchQueue.pending = false;
		FetchQueue.debug && console.log(`finished: ${this.#id}/${FetchQueue.fetchCount}`)
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

class CrmException {
	constructor(public message: string, public code: string = "RPC", public detail: string = "") { }
	toString() {
		return [this.code, this.message, this.detail].join(" - ");
	}

	static fromJsonApiErrorNode(o: JsonApiErrorNode) {
		return new CrmException(o.title, o.id, o.detail)
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
