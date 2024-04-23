import { CrmEnv } from "./crm-env.js";
import { findDeep, FetchQueue } from './utils/utils.js';
import { IRpcNamedOperation } from './types/private.js';
import { RemoteObject } from './remote-objects/remote-object.js';
import { parseEfficyCookieString } from "./cookie.js";

/**
 * Class with low-level JSON RPC functions
 */
export class RemoteAPI {
	#name = "RemoteAPI";
	remoteObjects: RemoteObject[] = [];
	requestCounter: number = 0;
	sessionId?: string;
	errorFunction?: Function;	
	onBeforeFetch?: Function;
	onAfterFetch?: Function;

	protected _lastResponseObject: object | null = null;
	
	/**
	 * Construct a RemoteAPI object
	 */
	constructor(public crmEnv = new CrmEnv(), public logFunction?: Function, public threadId: number = 1) {
		if (crmEnv && typeof crmEnv !== "object") throw new TypeError(`${this.#name}.constructor::crmEnv is not an Object`);
		if (logFunction && typeof logFunction !== "function") throw new TypeError(`${this.#name}.constructor::logFunction is not a function`);
		if (threadId) this.threadId = threadId;

		this.logFunction = logFunction;

		this.setFetchOptions();
	}

	private setFetchOptions() {
		try {
			let headers: Record<string, any> = {...this.fetchOptions.headers};			

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
		} catch(ex: unknown) {
			if (ex instanceof Error) {
				this.throwError(`${this.#name}.setFetchOptions::${ex.message}`)
			} else {
				console.error(ex);
			}		
		}
	}

	private fetchOptions: RequestInit = {
		method: "POST",
		headers: {
			'Content-Type': 'application/json',
			'Accept': 'application/json'
		},
		credentials: 'include' // Always send user credentials (cookies, basic http auth, etc..), even for cross-origin calls.
	}

	/**
	 * Execute all assembled and queued RPC operations
	 */
	async executeBatch() {
		const requestObject: IRpcNamedOperation[] = [];

		try {
			this.remoteObjects.forEach(item => {
				// @ts-ignore using protected method
				const jsonRPC = item.asJsonRpc();
				if (jsonRPC) {
					requestObject.push(jsonRPC);
				}
			})
		} catch(ex: unknown) {
			if (ex instanceof Error) {
				this.throwError(`${this.#name}.executeBatch::asJsonRpc\n${ex.message}`)
			} else {
				console.error(ex);
			}		
		}


		// Nothing to execute, ignore silently
		if (!requestObject.length) return;
		
		const responseOperations: IRpcNamedOperation[] = await this.postToCrmJson(requestObject);

		// Add response info to operations and remove executed operations (handled or not)
		const items = this.remoteObjects;
		var index = items.length
		while (index--) {
			const operation = items[index];
			const respOper = responseOperations.find(respOper => {
				// @ts-ignore using protected member
				return respOper["#id"] === operation.id;
			});
			if (!respOper)
			this.throwError(`${this.#name}.executeBatch::cannot find response for queued operation [${index}/${items.length}]`);
			// @ts-ignore using protected method
			Object.assign(operation.responseObject, respOper);
			// @ts-ignore using protected method
			operation.afterExecute();
			items.splice(index, 1);
		}
	}

	private throwError(rpcException: string | RPCException) {
		const errorMessage = typeof rpcException === "string" ? rpcException : rpcException.toString();
		if (typeof this.errorFunction === "function") {
			this.errorFunction(errorMessage);
		} else {
			throw Error(errorMessage);
		}
	}

	/**
	 * Logoff the remote session
	 */
	logoff() {
		this.crmEnv.logOff = true;
		this.setFetchOptions();
	}

	private async postToCrmJson(requestObject: object): Promise<IRpcNamedOperation[]> {
		const responseOperations: IRpcNamedOperation[] = [];
		const requestUrl = `${this.crmEnv.url}/crm/json${this.crmEnv.customer ? "?customer=" + encodeURIComponent(this.crmEnv.customer) : ""}`;

		const response: object = await this.post(requestUrl, requestObject)
			
		if (Array.isArray(response)) {
			response.forEach(item => {
				if (isJSONRPCNamedOperation(item)) {
					responseOperations.push(item);
				}
			})		
		} else if (!response) {
			throw new TypeError(`${this.#name}.postToCrmJson::empty response`);
		} else {
			throw new TypeError(`${this.#name}.postToCrmJson::responseObject is not an Array`);
		}

		return responseOperations;
	}

	/**
	 * Post and receive JSON with custom endpoint
	 */
	async post(requestUrl: string, requestObject: RequestInit): Promise<object> {
		let response: Response | null = null;
		let responseBody: string = "";
		let responseObject: object = {};
		let rpcException: RPCException | undefined;
		

		try {
			const request: RequestInit = Object.assign(this.fetchOptions, {body: JSON.stringify(requestObject)});
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

				this.#onBeforeFetch(requestUrl, request);
				response = await fetch(requestUrl, request);

				try {
					responseBody = await response.text();
					responseObject = JSON.parse(responseBody || "[]");
					this._lastResponseObject = responseObject;
				} catch(ex) {
					this.throwError(`invalid JSON response from resource '${requestUrl}'`)
				}
			} finally {
				fetchQueue.finished();
				this.#onAfterFetch(requestUrl, request, response);
			}

			rql.setResponse(response, responseObject);			
			rpcException = rql.rpcException = this.getRpcException(responseObject);

			const cookieString  = response.headers.get('set-cookie');
			if (cookieString) {
				const cookie = parseEfficyCookieString(cookieString);
				this.crmEnv.cookies = [cookie];
				this.sessionId = this.crmEnv.shortSessionId;
			}			

			rql.log();			
		} catch(ex) {
			if (ex instanceof Error) {
				this.throwError(`${this.#name}.post::${ex.message}`)
			} else {
				console.error(ex);
			}	
		}

		if (rpcException instanceof RPCException) {
			this.throwError(rpcException);
		}

		return responseObject;
	}
	
	private getRpcException(responseObject: any): RPCException | undefined {
		if (Array.isArray(responseObject)) {
			const errWrapper = responseObject.find(operation => operation["@name"] === "exception")
			if (errWrapper && errWrapper["#error"]) {
				const err = errWrapper["#error"];
				return new RPCException(err.message ?? err.errorstring, err.code ?? err.errorcode, err.detail);	
			}			
		} else if (Array.isArray(responseObject.errors) && responseObject.errors.length > 0) {
			const [err] = responseObject.errors;
			return new RPCException(err.detail, err.id, err.exta);			
		} else if (typeof responseObject === "object" && typeof responseObject["#error"] === "object") {
			const err = responseObject["#error"];
			return new RPCException(err.message ?? err.errorstring, err.code ?? err.errorcode, err.detail);	
		} else if (typeof responseObject === "object" && responseObject["error"] === true) {
			const err = responseObject;
			return new RPCException(err.message ?? err.errorstring, err.code ?? err.errorcode, err.detail);	
		}
	}

	#onBeforeFetch(requestUrl: string, request: RequestInit) {
		if (typeof this.onBeforeFetch === "function") this.onBeforeFetch(this, arguments);
	}

	#onAfterFetch(requestUrl: string, request: RequestInit, response?: any) {
		if (typeof this.onAfterFetch === "function") this.onAfterFetch(this, arguments);
	}
};

class RequestLog {
	d_request = new Date();
	d_response?: Date;
	elapsed_ms?: number;
	sessionId?: string;

	method = "";
	statusCode = 0;
	statusText = "";
	requestUrl = "";
	rpcException?: RPCException;

	// Not exposed when doing JSON.stringify(this)
	requestObject: any;
	responseObject: any;

	constructor(public requestId: number, public logFunction?: Function, public threadId?: number) {
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
				this.logFunction(`<${prefix},${this.statusCode} ${this.statusText} (${this.elapsed_ms} ms)${this.sessionId ? `,${this.sessionId}`: ","}${this.rpcException ? ",EXCEPTION_RPC": ""}`, this);
			} else {
				this.logFunction(`>${prefix},FUNCS-${this.countFuncItems(this.requestObject)}`, this);
			}
		}

	}

	#cloneAndClean(object: any) {
		const data = JSON.parse(JSON.stringify(object));

		// Remove long data strings -> TODO, clean multiple hits
		const result: any = findDeep(data, {"encodingkind": "MIME64"});
		if (result && typeof result["@data"] === "string" && result["@data"].length > 100) {
			result["@data"] = "**CLEANED**";
		}

		return data;
	}
};

class RPCException {
	constructor(public message: string, public code: string = "RPC", public detail: string = "") {}
	toString() {
		return [this.code, this.message, this.detail].join(" - ");
	}
}

function isJSONRPCNamedOperation(obj: any): obj is IRpcNamedOperation {
    return typeof obj['#id'] === 'string' && typeof obj['@name'] === 'string' && Array.isArray(obj['@func']);
}