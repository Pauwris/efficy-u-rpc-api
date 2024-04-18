import RemoteAPI from "src/remote-api.js";
import { DataSetObject } from "./dataset.js";
import { JSONPrimitive, JSONPrimitiveObject } from "src/types/index.js";

export class QuerySQLObject extends DataSetObject {
	constructor(remoteAPI: RemoteAPI, public sql: string, public queryParams: string[] = [], public loadBlobs = false, public recordCount = 0) {
		super(remoteAPI);
	}

	asJsonRpc() {
		const api: JSONPrimitiveObject = {
			"@name": "executesqlquery",
			"sql": this.sql,
			"loadBlobs": this.loadBlobs,
			"recordCount": this.recordCount,
		}

		if (Array.isArray(this.queryParams)) {
			api.queryparams = this.queryParams.join("\n");
		}

		const requestObject = this.requestObject = {
			"#id": this.id,
			"@name": "api",
			"@func": [api]
		};

		return requestObject;
	}
}

export class QueryObject extends DataSetObject {
	
	constructor(remoteAPI: RemoteAPI, public key?: string, public master?: number, public detail?: number, public queryParams: string[] = [], public loadBlobs = false, public recordCount = 0) {
		super(remoteAPI);
	}

	asJsonRpc() {
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

		const requestObject = this.requestObject = {
			"#id": this.id,
			"@name": "api",
			"@func": [api]
		};
		
		return requestObject;
	}
}