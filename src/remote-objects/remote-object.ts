import { uuidv4 } from '../utils/utils.js';
import { ParseGentle } from '../utils/parsing.js';
import RemoteAPI from 'src/remote-api.js';
import { JSONRPCNamedOperation } from 'src/types/index.js';

/**
 * Low level class representing an RPC operation
 */
export class RemoteObject {
	protected requestObject: JSONRPCNamedOperation | null;	
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

	protected asJsonRpc(): JSONRPCNamedOperation | null {
		return null
	}
}