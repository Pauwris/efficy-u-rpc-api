import { JsonRpcApi } from "src/crm-rpc.js";
import { RpcObject } from "./rpc-object.js";
import { RpcNamedOperation } from "src/types.js";

/**
 * Class uses by operations that return a string result
 */
class StringObject extends RpcObject {	
	protected operationName: string = "";
    result: string = "";

	constructor(remoteAPI: JsonRpcApi) {
		super(remoteAPI);
		this.registerObject(this);
	}

	protected afterExecute() {
		super.afterExecute();
        const output = this.findFunc(this.responseObject, this.operationName)?.["#result"];
        if (output && typeof output === "string") {
            this.result = output;
        }		
	}
}

/**
 * Class returned by API property operation such as currentdatabasealias, currentuserfullname
 */
export class PropertyObject extends StringObject {
	constructor(remoteAPI: JsonRpcApi, public name: string) {
		super(remoteAPI);
		this.operationName = name;
		this.registerObject(this);
	}
	
	protected asJsonRpc() {
		const api = {
			"@name": this.operationName
		}

		const requestObject: RpcNamedOperation = this.requestObject = {
			"#id": this.id,
			"@name": "api",
			"@func": [api]
		};

		return requestObject;
	}
}

/**
 * Class returned by getSetting operation
 */
export class SettingObject extends StringObject {
    protected operationName = "getsetting";

    /**
     * @param remoteAPI 
     * @param module The name of the module (JSON object) that owns the setting.
     * @param name The name of the setting.
     * @param asString If true, the settings of type TDateTime will be returned as a string formatted with the ShortDateTime format. If false, it will be returned as a float value.
     */
	constructor(remoteAPI: JsonRpcApi, private module: string, private name: string, private asString = true) {
		super(remoteAPI);
		this.registerObject(this);
	}

	/** @protected */
	asJsonRpc() {
		const api =  {
			"@name": this.operationName,
			"module": this.module,
			"name": this.name,
			"asstring": this.asString
		};

		const requestObject = this.requestObject = {
			"#id": this.id,
			"@name": "api",
			"@func": [api]
		};

		return requestObject;
	}
}