import { JsonRpcApi } from "src/crm-rpc.js";
import { RpcObject } from "./rpc-object.js";
import { RpcNamedOperation } from "src/types.js";

/**
 * Class uses by operations that return a list
 */
class ListObject extends RpcObject {
    map: Map<string, string> = new Map();

    constructor(remoteAPI: JsonRpcApi) {
        super(remoteAPI);
        this.registerObject(this);
    }

    protected afterExecute() {
        super.afterExecute();
        const items = this.findListArray(this.responseObject);

        if (Array.isArray(items)) {
            this.map = new Map(items
                .map(item => String(item))
                .map(item => [item.split("=")[0], item.split("=")[1]])
            );
        }
    }
}

/**
 * Class returned by getSystemSettings operations.
 */
export class SystemSettings extends ListObject {
    constructor(remoteAPI: JsonRpcApi) {
        super(remoteAPI);
        this.registerObject(this);
    }

    protected asJsonRpc() {
        const api = {
            "@name": "systemsettings"
        }

        const requestObject: RpcNamedOperation = this.requestObject = {
            "#id": this.id,
            "@name": "api",
            "@func": [api]
        };

        return requestObject;
    }
}