import RemoteAPI from "src/remote-api.js";
import { DataSetObject } from "./dataset.js";
import { JSONPrimitive, JSONPrimitiveObject, JSONRPCNamedOperation } from "src/types/index.js";

export class QuerySQLObject extends DataSetObject {
	constructor(remoteAPI: RemoteAPI, private sql: string, private queryParams: string[] = [], private loadBlobs = false, private recordCount = 0) {
		super(remoteAPI);
	}

	protected asJsonRpc(): JSONRPCNamedOperation {
		const api: JSONPrimitiveObject = {
			"@name": "executesqlquery",
			"sql": this.sql,
			"loadBlobs": this.loadBlobs,
			"recordCount": this.recordCount,
		}

		if (Array.isArray(this.queryParams)) {
			api.queryparams = this.queryParams.join("\n");
		}

		const requestObject: JSONRPCNamedOperation = this.requestObject = {
			"#id": this.id,
			"@name": "api",
			"@func": [api]
		};

		return requestObject;
	}
}

export class QueryObject extends DataSetObject {
	
	constructor(remoteAPI: RemoteAPI, private key?: string, private master?: number, private detail?: number, private queryParams: string[] = [], private loadBlobs = false, private recordCount = 0) {
		super(remoteAPI);
	}

	protected asJsonRpc(): JSONRPCNamedOperation {
		const api: JSONPrimitiveObject = {
			"@name": "query",
			"loadBlobs": this.loadBlobs,
			"recordCount": this.recordCount
		}

		api.key = this.key;
		if (typeof this.master === "number") api.master = this.master;
		if (typeof this.detail === "number") api.detail = this.detail;

		if (Array.isArray(this.queryParams)) {
			api.queryparams = this.queryParams.join("|");
		}

		const requestObject: JSONRPCNamedOperation = this.requestObject = {
			"#id": this.id,
			"@name": "api",
			"@func": [api]
		};
		
		return requestObject;
	}
}