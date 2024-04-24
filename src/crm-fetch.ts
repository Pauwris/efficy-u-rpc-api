import { CrmEnv } from "./crm-env.js";
import { findDeep } from './crm-rpc/utils.js';
import { ErrorFunction, LogFunction } from "./types.js";

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

	protected async fetch(requestUrl: string, requestObject: RequestInit): Promise<object> {
		let response: Response | null = null;
		let responseBody: string = "";
		let responseObject: object = {};
		let crmException: CrmException | undefined;

		try {
			const request: RequestInit = Object.assign(this.fetchOptions, { body: JSON.stringify(requestObject) });
			const rql = new RequestLog(this.requestCounter++, this.logFunction, this.threadId);

			rql.setRequest(requestUrl, request.method ?? "POST", requestObject);
			if (this.crmEnv.cookieHeader) {
				request.headers = {
					"Cookie": this.crmEnv.cookieHeader
				}
				rql.sessionId = this.crmEnv.shortSessionId;
			}


			const fetchQueue = new FetchQueue();
			try {
				await fetchQueue.waitMyTurn();
				rql.log();

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

			rql.setResponse(response, responseObject);
			crmException = rql.rpcException = this.getCrmException(responseObject);

			const cookieString = response.headers.get('set-cookie');
			if (cookieString) {
				const cookie = parseEfficyCookieString(cookieString);
				this.crmEnv.cookies = [cookie];
				this.sessionId = this.crmEnv.shortSessionId;
			}

			rql.log();
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

	private getCrmException(responseObject: any): CrmException | undefined {
		if (Array.isArray(responseObject)) {
			const errWrapper = responseObject.find(operation => operation["@name"] === "exception")
			if (errWrapper && errWrapper["#error"]) {
				const err = errWrapper["#error"];
				return new CrmException(err.message ?? err.errorstring, err.code ?? err.errorcode, err.detail);
			}
		} else if (Array.isArray(responseObject.errors) && responseObject.errors.length > 0) {
			const [err] = responseObject.errors;
			return new CrmException(err.detail, err.id, err.exta);
		} else if (typeof responseObject === "object" && typeof responseObject["#error"] === "object") {
			const err = responseObject["#error"];
			return new CrmException(err.message ?? err.errorstring, err.code ?? err.errorcode, err.detail);
		} else if (typeof responseObject === "object" && responseObject["error"] === true) {
			const err = responseObject;
			return new CrmException(err.message ?? err.errorstring, err.code ?? err.errorcode, err.detail);
		}
	}
}

class RequestLog {
	d_request = new Date();
	d_response?: Date;
	elapsed_ms?: number;
	sessionId?: string;

	method = "";
	statusCode = 0;
	statusText = "";
	requestUrl = "";
	rpcException?: CrmException;

	// Not exposed when doing JSON.stringify(this)
	requestObject: any;
	responseObject: any;

	constructor(public requestId: number, public logFunction?: LogFunction, public threadId?: number) {
	}

	countFuncItems(rpcObject: object) {
		return Array.isArray(rpcObject) && rpcObject.length > 0 && Array.isArray(rpcObject[0]["@func"]) ? rpcObject[0]["@func"].length : 0;
	}

	setRequest(url: string, method: string, requestObject: any) {
		this.requestUrl = url;
		this.method = method;
		this.requestObject = requestObject;
	}
	setResponse(resp: any, responseObject: object) {
		this.d_response = new Date();
		this.statusCode = parseInt(resp.status, 10);
		this.statusText = resp.statusText;
		this.elapsed_ms = this.d_response.getTime() - this.d_request.getTime()
		this.responseObject = this.#cloneAndClean(responseObject);
	}

	log() {
		const prefix = `${this.threadId},${this.method}-${[this.requestId]}`;

		if (typeof this.logFunction === "function") {
			if (this.statusCode > 0) {
				this.logFunction(`<${prefix},${this.statusCode} ${this.statusText} (${this.elapsed_ms} ms)${this.sessionId ? `,${this.sessionId}` : ","}${this.rpcException ? ",EXCEPTION_RPC" : ""}`, this);
			} else {
				this.logFunction(`>${prefix},FUNCS-${this.countFuncItems(this.requestObject)}`, this);
			}
		}

	}

	#cloneAndClean(object: any) {
		const data = JSON.parse(JSON.stringify(object));

		// Remove long data strings -> TODO, clean multiple hits
		const result: any = findDeep(data, { "encodingkind": "MIME64" });
		if (result && typeof result["@data"] === "string" && result["@data"].length > 100) {
			result["@data"] = "**CLEANED**";
		}

		return data;
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
