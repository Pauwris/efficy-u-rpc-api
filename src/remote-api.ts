import nodeFetch from 'node-fetch';
import CrmEnv from "./crm-env.js";
import * as cookieParser from 'cookie';
import { findDeep, FetchQueue } from './utils/utils.js';
import { JSONPrimitiveObject, JSONRPCNamedOperation, isJSONRPCNamedOperation } from './types/index.js';
import { RemoteObject } from './remote-objects/remote-object.js';

/**
 * Class with low-level JSON RPC functions
 * @see {@link https://stackoverflow.com/questions/17575790/environment-detection-node-js-or-browser}
 */
class RemoteAPI {
	#name = "RemoteAPI";
	remoteObjects: RemoteObject[] = [];
	requestCounter: number = 0;

	sessionId?: string;

	errorFunction?: Function;	
	onBeforeFetch?: Function;
	onAfterFetch?: Function;
	
	/**
	 * Construct a RemoteAPI object
	 */
	constructor(public crmEnv = new CrmEnv(), public logFunction?: Function, public threadId: number = 1) {
		if (crmEnv && typeof crmEnv !== "object") throw new TypeError(`${this.#name}.constructor::crmEnv is not an Object`);
		if (logFunction && typeof logFunction !== "function") throw new TypeError(`${this.#name}.constructor::logFunction is not a function`);
		if (threadId) this.threadId = threadId;

		this.logFunction = logFunction;

		this.#setFetchOptions();
	}

	#setFetchOptions() {
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

	fetchOptions: RequestInit = {
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
		const requestObject: JSONRPCNamedOperation[] = [];

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
		
		const responseOperations: JSONRPCNamedOperation[] = await this.postToCrmJson(requestObject);

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

	throwError(rpcException: string | RPCException) {
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
		this.#setFetchOptions();
	}

	registerObject(object: RemoteObject) {
		this.remoteObjects.push(object);
	}

	private async postToCrmJson(requestObject: object): Promise<JSONRPCNamedOperation[]> {
		const responseOperations: JSONRPCNamedOperation[] = [];
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
				const parsedCookies = cookieParser.parse(cookieString);

				const name = parsedCookies["name"];
				const value = parsedCookies[name];
				
				this.crmEnv.cookies = [{name, value}];
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

	
	findDataSetArray(resp: JSONPrimitiveObject, dataSetName = "dataset"): JSONPrimitiveObject[] {
		let list: JSONPrimitiveObject[] = [];
		if (typeof resp !== "object") return list;

		const result = findDeep(resp, {"#class": dataSetName});
		if (!result || typeof result["#data"] !== "object" || result["#data"] === null) return list;

		if (Array.isArray(result["#data"])) {
			list = result["#data"] ?? [];
		} else if (Array.isArray(result["#data"]["data"])) {
			list = result["#data"]["data"] ?? [];
		}

		return list;
	}
	findListArray(resp: JSONPrimitiveObject, listName = "stringlist"): JSONPrimitiveObject[] {
		return this.findDataSetArray(resp, listName) ?? [];
	}
	
	findAttachment(resp: JSONPrimitiveObject, key: string) {
		if (typeof resp !== "object") return;
		return findDeep(resp, {"@name": "attachment", "key": key});
	}
	
	findFunc(resp: JSONPrimitiveObject, name: string) {
		if (typeof resp !== "object" || !Array.isArray(resp["@func"])) return;
		return resp["@func"].find(item => item["@name"] === name);
	}
	
	findFunc2(resp: JSONPrimitiveObject, name: string, name2: string, value2: string | number) {
		if (typeof resp !== "object" || !Array.isArray(resp["@func"])) return;
		return resp["@func"].find(item => item["@name"] === name && item[name2] === value2);
	}
	
	findFuncArray(resp: JSONPrimitiveObject, name: string) {
		var result = this.findDataSetArray(this.findFunc(resp, name));
		return Array.isArray(result) ? result : null;
	}
	
	findFuncArray2(resp: JSONPrimitiveObject, name: string, name2: string, value2: string | number) {
		var result = this.findDataSetArray(this.findFunc2(resp, name, name2, value2));
		return Array.isArray(result) ? result : null;
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

export class RPCException {
	constructor(public message: string, public code: string = "RPC", public detail: string = "") {}
	toString() {
		return [this.code, this.message, this.detail].join(" - ");
	}
}

/*
 * Platform agnostic solution for the definition of fetch. Lib node-fetch is excluded by rollup ignore plugin
 */
const isNode = (typeof process !== "undefined" && process?.versions?.node ? true : false);
if (isNode) {
	// @ts-ignore
	globalThis.fetch = nodeFetch;
}

export default RemoteAPI;