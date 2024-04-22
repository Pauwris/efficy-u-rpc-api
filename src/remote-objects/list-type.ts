import { RemoteAPI } from "src/remote-api.js";
import { RemoteObject } from "./remote-object.js";
import { JSONRPCNamedOperation } from "src/types.js";

/**
 * Class uses by operations that return a list
 */
class ListObject extends RemoteObject {
    map: Map<string, string> = new Map();

    constructor(remoteAPI: RemoteAPI) {
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
    constructor(remoteAPI: RemoteAPI) {
        super(remoteAPI);
        this.registerObject(this);
    }

    protected asJsonRpc() {
        const api = {
            "@name": "systemsettings"
        }

        const requestObject: JSONRPCNamedOperation = this.requestObject = {
            "#id": this.id,
            "@name": "api",
            "@func": [api]
        };

        return requestObject;
    }
}