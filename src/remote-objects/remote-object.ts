import { findDeep, uuidv4 } from '../utils/utils.js';
import { ParseGentle } from '../utils/parsing.js';
import { RemoteAPI } from 'src/remote-api.js';
import { JSONPrimitiveObject } from 'src/types/public.js';
import { IRpcNamedOperation } from 'src/types/private.js';

/**
 * Low level class representing an RPC operation
 */
export class RemoteObject {
	protected requestObject: IRpcNamedOperation | null;	
	protected id;
	protected responseObject;

	constructor(private remoteAPI: RemoteAPI) {
		this.remoteAPI = remoteAPI;
		this.id = uuidv4();
		this.requestObject = null;
		this.responseObject = {};
	}

	protected get api() {
		return this.remoteAPI;
	}

	protected afterExecute() {
		this.responseObject = ParseGentle.numberProperties(this.responseObject, ["edithandle"]);
	}

	protected asJsonRpc(): IRpcNamedOperation | null {
		return null
	}

	protected registerObject(object: RemoteObject) {
		this.remoteAPI.remoteObjects.push(object);
	}

	protected findDataSetArray(resp: JSONPrimitiveObject, dataSetName = "dataset"): JSONPrimitiveObject[] {
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
	protected findListArray(resp: JSONPrimitiveObject, listName = "stringlist"): JSONPrimitiveObject[] {
		return this.findDataSetArray(resp, listName) ?? [];
	}
	
	protected findAttachment(resp: JSONPrimitiveObject, key: string) {
		if (typeof resp !== "object") return;
		return findDeep(resp, {"@name": "attachment", "key": key});
	}
	
	protected findFunc(resp: JSONPrimitiveObject, name: string) {
		if (typeof resp !== "object" || !Array.isArray(resp["@func"])) return;
		return resp["@func"].find(item => item["@name"] === name);
	}
	
	protected findFunc2(resp: JSONPrimitiveObject, name: string, name2: string, value2: string | number) {
		if (typeof resp !== "object" || !Array.isArray(resp["@func"])) return;
		return resp["@func"].find(item => item["@name"] === name && item[name2] === value2);
	}
	
	protected findFuncArray(resp: JSONPrimitiveObject, name: string) {
		const result = this.findDataSetArray(this.findFunc(resp, name));
		return Array.isArray(result) ? result : null;
	}
	
	protected findFuncArray2(resp: JSONPrimitiveObject, name: string, name2: string, value2: string | number) {
		const result = this.findDataSetArray(this.findFunc2(resp, name, name2, value2));
		return Array.isArray(result) ? result : null;
	}
}