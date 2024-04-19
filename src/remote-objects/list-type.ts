import RemoteAPI from "src/remote-api.js";
import { StringifyOptions } from "querystring";
import { RemoteObject } from "./remote-object.js";

/**
 * Class uses by operations that return a list
 */
class ListObject extends RemoteObject {
    map: Map<string, string> | null = null;

    constructor(remoteAPI: RemoteAPI) {
        super(remoteAPI);
        this.api.registerObject(this);
    }

    protected afterExecute() {
        super.afterExecute();
        const items = this.api.findListArray(this.responseObject);

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
        this.api.registerObject(this);
    }

    protected asJsonRpc() {
        const api = {
            "@name": "systemsettings"
        }

        const requestObject = this.requestObject = {
            "#id": this.id,
            "@name": "api",
            "@func": [api]
        };

        return requestObject;
    }
}