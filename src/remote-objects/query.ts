import { RemoteAPI } from "src/remote-api.js";
import { RemoteDataSet } from "./dataset.js";
import { JSONPrimitiveObject, UKey } from "src/types/public.js";
import { IRpcNamedOperation } from "src/types/private.js";

export class QuerySQLObject extends RemoteDataSet {
	constructor(remoteAPI: RemoteAPI, private sql: string, private queryParams: string[] = [], private loadBlobs = false, private recordCount = 0) {
		super(remoteAPI);
	}

	protected asJsonRpc(): IRpcNamedOperation {
		const api: JSONPrimitiveObject = {
			"@name": "executesqlquery",
			"sql": this.sql,
			"loadBlobs": this.loadBlobs,
			"recordCount": this.recordCount,
		}

		if (Array.isArray(this.queryParams)) {
			api.queryparams = this.queryParams.join("\n");
		}

		const requestObject: IRpcNamedOperation = this.requestObject = {
			"#id": this.id,
			"@name": "api",
			"@func": [api]
		};

		return requestObject;
	}
}

export class QueryObject extends RemoteDataSet {
	
	constructor(remoteAPI: RemoteAPI, private key?: UKey, private master?: number, private detail?: number, private queryParams: string[] = [], private loadBlobs = false, private recordCount = 0) {
		super(remoteAPI);
	}

	protected asJsonRpc(): IRpcNamedOperation {
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

		const requestObject: IRpcNamedOperation = this.requestObject = {
			"#id": this.id,
			"@name": "api",
			"@func": [api]
		};
		
		return requestObject;
	}
}