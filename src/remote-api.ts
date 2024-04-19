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
				this.throwError(`${this.#name}.readEnv::${ex.message}`)
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
		const responseArray: JSONRPCNamedOperation[] = [];

		try {
			this.remoteObjects.forEach(item => {
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

		try {
			const response: object = await this.postToCrmJson(requestObject);
			
			if (Array.isArray(response)) {
				response.forEach(item => {
					if (isJSONRPCNamedOperation(item)) {
						responseArray.push(item);
					}
				})		
			} else if (typeof response === "object" && this.getRpcException(response)) {
				const ex = this.getRpcException(response);
				this.throwError(`${ex["#error"].errorcode} - ${ex["#error"].errorstring}`);
			} else if (!response) {
				throw new TypeError(`${this.#name}.executeBatch::empty response`);
			} else {
				throw new TypeError(`${this.#name}.executeBatch::responseObject is not an Array`);
			}
		} catch(ex: unknown) {			
			if (ex instanceof Error) {
				this.throwError(`${this.#name}.executeBatch::${ex.message}`);
			} else {
				console.error(ex);
			}
		}

		// Add response info to operations and remove executed operations (handled or not)
		const items = this.remoteObjects;
		var index = items.length
		while (index--) {
			const operation = items[index];
			const respOper = responseArray.find(respOper => respOper["#id"] === operation.id);
			if (!respOper)
			this.throwError(`${this.#name}.executeBatch::cannot find response for queued operation [${index}/${items.length}]`);
			Object.assign(operation.responseObject, respOper);
			operation.afterExecute();
			items.splice(index, 1);
		}

		// Error handling
		const ex = this.getRpcException(responseArray);
		if (ex) this.throwError(`${ex["#error"].errorcode} - ${ex["#error"].errorstring}`);
	}

	throwError(message: string) {
		if (typeof this.errorFunction === "function") {
			this.errorFunction(message);
		} else {
			throw Error(message);
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

	private async postToCrmJson(requestObject: object) {
		const requestUrl = `${this.crmEnv.url}/crm/json${this.crmEnv.customer ? "?customer=" + encodeURIComponent(this.crmEnv.customer) : ""}`;
		return this.post(requestUrl, requestObject)
	}

	/**
	 * Post and receive JSON with custom endpoint
	 */
	async post(requestUrl: string, requestObject: RequestInit): Promise<object> {
		let response: Response | null = null;
		let responseBody: string = "";
		let responseObject: object = {};

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
			rql.exception = this.getRpcException(responseObject);

			const cookieString  = response.headers.get('set-cookie');
			if (cookieString) {
				const parsedCookies = cookieParser.parse(cookieString);

				const name = parsedCookies["name"];
				const value = parsedCookies[name];
				
				this.crmEnv.cookies = [{name, value}];
				this.sessionId = this.crmEnv.shortSessionId;
			}			

			rql.log();

			if (rql.exception?.error === true) {
				const ex = rql.exception;
				this.throwError(`/json: ${ex?.code || ex?.errorcode} - ${ex?.message || ex?.errorstring} - ${ex?.detail}`);
			}			
		} catch(ex) {
			if (ex instanceof Error) {
				this.throwError(`${this.#name}.post::${ex.message}`)
			} else {
				console.error(ex);
			}	
		}

		return responseObject;
	}


	/** @private */
	findDataSetArray(resp, dataSetName = "dataset") {
		if (typeof resp !== "object") return;

		const result = findDeep(resp, {"#class": dataSetName});
		if (!result || typeof result["#data"] !== "object" || result["#data"] === null) return;

		if (Array.isArray(result["#data"])) {
			return result["#data"];
		} else if (Array.isArray(result["#data"]["data"])) {
			return result["#data"]["data"]; // Efficy U (with earlier bug)
		}
	}
	findListArray(resp, listName = "stringlist") {
		return this.findDataSetArray(resp, listName);
	}
	/** @private */
	findAttachment(resp, key) {
		if (typeof resp !== "object") return;
		return findDeep(resp, {"@name": "attachment", "key": key});
	}
	/** @private */
	findFunc(resp, name) {
		if (typeof resp !== "object" || !Array.isArray(resp["@func"])) return;
		return resp["@func"].find(item => item["@name"] === name);
	}
	/** @private */
	findFunc2(resp, name, name2, value2) {
		if (typeof resp !== "object" || !Array.isArray(resp["@func"])) return;
		return resp["@func"].find(item => item["@name"] === name && item[name2] === value2);
	}
	/** @private */
	findFuncArray(resp, name) {
		var result = this.findDataSetArray(this.findFunc(resp, name));
		return Array.isArray(result) ? result : null;
	}
	/** @private */
	findFuncArray2(resp, name, name2, value2) {
		var result = this.findDataSetArray(this.findFunc2(resp, name, name2, value2));
		return Array.isArray(result) ? result : null;
	}
	/** @private */
	findFuncCategoryArray(resp, category) {
		var result = this.findDataSetArray(this.findFunc2(resp, "category", "category", category));
		return Array.isArray(result) ? result : null;
	}
	/** @private */
	findFuncDetailArray(resp, detail) {
		var result = this.findDataSetArray(this.findFunc2(resp, "detail", "detail", detail));
		return Array.isArray(result) ? result : null;
	}
	/** @private */
	getRpcException(responseObject) {
		if (Array.isArray(responseObject)) {
			return responseObject.find(operation => operation["@name"] === "exception");
		} else if (Array.isArray(responseObject.errors) && responseObject.errors.length > 0) {
			const [e] = responseObject.errors;
			return {
				"#error": {
					error: true,
					errorcode: e.id,
					errorstring: e.detail,
					extra: e.extra
				}
			}
		} else if (typeof responseObject === "object" && typeof responseObject["#error"] === "object") {
			const errorObject = responseObject["#error"];
			errorObject.error = true;
			return errorObject;
		} else if (typeof responseObject === "object" && responseObject["error"] === true) {
			return {
				"#error": {
					error: true,
					errorcode: responseObject.code,
					errorstring: responseObject.message
				}
			}
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
	exception?: JSONPrimitiveObject;

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
				this.logFunction(`<${prefix},${this.statusCode} ${this.statusText} (${this.elapsed_ms} ms)${this.sessionId ? `,${this.sessionId}`: ","}${this.exception ? ",EXCEPTION_RPC": ""}`, this);
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

/*
 * Platform agnostic solution for the definition of fetch. Lib node-fetch is excluded by rollup ignore plugin
 */
const isNode = (typeof process !== "undefined" && process?.versions?.node ? true : false);
if (isNode) {
	// @ts-ignore
	globalThis.fetch = nodeFetch;
}

export default RemoteAPI;