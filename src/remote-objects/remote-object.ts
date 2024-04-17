import { uuidv4 } from '../utils/utils.js';
import { ParseGentle } from '../utils/parsing.js';
import RemoteAPI from 'src/remote-api.js';

/**
 * Low level class representing an RPC operation
 */
export class RemoteObject {
	protected requestObject;
	protected responseObject;
	protected id;

	constructor(private remoteAPI: RemoteAPI) {
		this.remoteAPI = remoteAPI;
		this.id = uuidv4();
		this.requestObject = {};
		this.responseObject = {};
	}

	protected get api() {
		return this.remoteAPI;
	}

	protected afterExecute() {
		this.responseObject = ParseGentle.numberProperties(this.responseObject, ["edithandle"]);
	}
}