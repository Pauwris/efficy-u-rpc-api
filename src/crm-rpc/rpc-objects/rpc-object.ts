import { findDeep, uuidv4 } from '../utils.js';
import { JsonRpcApi } from 'src/crm-rpc/index.js';
import { JSONPrimitiveRecord } from 'src/types.js';
import { RpcNamedOperation } from 'src/types.js';

/**
 * Low level class representing an RPC operation
 */
export class RpcObject {
	protected requestObject: RpcNamedOperation | null;	
	protected id;
	protected responseObject;

	constructor(private remoteAPI: JsonRpcApi) {
		this.remoteAPI = remoteAPI;
		this.id = uuidv4();
		this.requestObject = null;
		this.responseObject = {};
	}

	protected get api() {
		return this.remoteAPI;
	}

	protected afterExecute() {
		
	}

	protected asJsonRpc(): RpcNamedOperation | null {
		return null
	}

	protected registerObject(object: RpcObject) {
		this.remoteAPI.remoteObjects.push(object);
	}

	protected findDataSetArray(resp: JSONPrimitiveRecord, dataSetName = "dataset"): JSONPrimitiveRecord[] {
		let list: JSONPrimitiveRecord[] = [];
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
	protected findListArray(resp: JSONPrimitiveRecord, listName = "stringlist"): JSONPrimitiveRecord[] {
		return this.findDataSetArray(resp, listName) ?? [];
	}
	
	protected findAttachment(resp: JSONPrimitiveRecord, key: string) {
		if (typeof resp !== "object") return;
		return findDeep(resp, {"@name": "attachment", "key": key});
	}
	
	protected findFunc(resp: JSONPrimitiveRecord, name: string) {
		if (typeof resp !== "object" || !Array.isArray(resp["@func"])) return;
		return resp["@func"].find(item => item["@name"] === name);
	}
	
	protected findFunc2(resp: JSONPrimitiveRecord, name: string, name2: string, value2: string | number) {
		if (typeof resp !== "object" || !Array.isArray(resp["@func"])) return;
		return resp["@func"].find(item => item["@name"] === name && item[name2] === value2);
	}
	
	protected findFuncArray(resp: JSONPrimitiveRecord, name: string) {
		const result = this.findDataSetArray(this.findFunc(resp, name));
		return Array.isArray(result) ? result : null;
	}
	
	protected findFuncArray2(resp: JSONPrimitiveRecord, name: string, name2: string, value2: string | number) {
		const result = this.findDataSetArray(this.findFunc2(resp, name, name2, value2));
		return Array.isArray(result) ? result : null;
	}
}