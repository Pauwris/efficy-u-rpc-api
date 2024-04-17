import RemoteAPI from "src/remote-api.js";
import { DataSetObject } from "./dataset.js";
import { JSONPrimitive, JSONPrimitiveObject } from "src/types/index.js";

export class QuerySQLObject extends DataSetObject {
    sql: string;
    queryParams: JSONPrimitive[];
    loadBlobs: boolean;
    recordCount: number;

	constructor(remoteAPI: RemoteAPI, sql: string, queryParams: JSONPrimitive[] = [], loadBlobs = false, recordCount = 0) {
		super(remoteAPI);
		this.sql = sql;
		this.queryParams = queryParams;
		this.loadBlobs = typeof loadBlobs === "boolean" ? loadBlobs : false;
		this.recordCount = recordCount;
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