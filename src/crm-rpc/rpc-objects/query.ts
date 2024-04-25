import { JsonRpcApi } from "src/crm-rpc/index.js";
import { RemoteDataSet } from "./dataset.js";
import { JSONPrimitiveRecord, UnityKey } from "src/types.js";
import { RpcNamedOperation } from "src/types.js";

export class QuerySQLObject extends RemoteDataSet {
	constructor(remoteAPI: JsonRpcApi, private sql: string, private queryParams: string[] = [], private loadBlobs = false, private recordCount = 0) {
		super(remoteAPI);
	}

	protected asJsonRpc(): RpcNamedOperation {
		const api: JSONPrimitiveRecord = {
			"@name": "executesqlquery",
			"sql": this.sql,
			"loadBlobs": this.loadBlobs,
			"recordCount": this.recordCount,
		}

		if (Array.isArray(this.queryParams)) {
			api.queryparams = this.queryParams.join("\n");
		}

		const requestObject: RpcNamedOperation = this.requestObject = {
			"#id": this.id,
			"@name": "api",
			"@func": [api]
		};

		return requestObject;
	}
}

export class QueryObject extends RemoteDataSet {
	
	constructor(remoteAPI: JsonRpcApi, private key?: UnityKey, private master?: number, private detail?: number, private queryParams: string[] = [], private loadBlobs = false, private recordCount = 0) {
		super(remoteAPI);
	}

	protected asJsonRpc(): RpcNamedOperation {
		const api: JSONPrimitiveRecord = {
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

		const requestObject: RpcNamedOperation = this.requestObject = {
			"#id": this.id,
			"@name": "api",
			"@func": [api]
		};
		
		return requestObject;
	}
}