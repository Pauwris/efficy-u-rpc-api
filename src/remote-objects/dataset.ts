import { RemoteObject } from './remote-object.js';
import { JSONPrimitiveObject, JSONRPCNamedOperation } from '../types/index.js'
import RemoteAPI from 'src/remote-api.js';

export type DataSetKind = "main" | "master" | "detail" | "category";

class DataSet {
	tableView: number = 0;

	private _items: JSONPrimitiveObject[] = [];
	private _item: JSONPrimitiveObject | null = null;

	constructor(public type: DataSetKind, public name?: string, public filter?: string, public includeBlobContent?: boolean) {
		if (!["main", "master", "detail", "category"].includes(type)) throw new TypeError("DataSet.constructor::invalid type");
		if (["detail", "category"].includes(type) && !name) throw new TypeError("DataSet.constructor::name must be specified");
		this.type = type;
		this.name = name;

		this.filter = filter && typeof filter == "string" ? filter : undefined;
		this.includeBlobContent = typeof includeBlobContent === "boolean" ? includeBlobContent : false;
	}

	/**
	 * The to array converted dataset
	 */
	get items() {
		return this._items;
	}

	/**
	 * When exists, the first item of the items array, else null
	 */
	get item() {
		return this._item;
	}

	setItems(value?: JSONPrimitiveObject[]) {
		if (!value) return;
		if (!Array.isArray(value)) throw new TypeError("DataSet.items::value is not an Array");
		
		this._items = value;
		if (this.items.length > 0) {
			this._item = this.items[0];
		}
	}

	get func() {
		const func: JSONPrimitiveObject = {};

		func["@name"] = this.type;
		if (this.name) func[this.type] = this.name;
		if (this.filter) func["filter"] = this.filter;
		if (this.tableView > 0) func["tableview"] = this.tableView;
		if (this.includeBlobContent) func["includeblobcontent"] = true;

		return func;
	};
}


/**
 * Represents a remotely fetched Efficy DataSet transformed as an array of row items
 */
export class DataSetObject extends RemoteObject {
	#items: JSONPrimitiveObject[] = [];
	#item: JSONPrimitiveObject | null = null;

	constructor(remoteAPI: RemoteAPI) {
		super(remoteAPI);
		this.api.registerObject(this);
	}

	protected dataSetName?: string;

	protected afterExecute() {
		super.afterExecute();

		const dso = new DataSet("main");
		dso.setItems(this.api.findDataSetArray(this.responseObject, this.dataSetName));
		this.#items = dso.items;
		this.#item = dso.item;
	}

	/**
	 * The to array converted dataset
	 */
	get items() {
		return this.#items;
	}

	/**
	 * When exists, the first item of the items, else null
	 */
	get item() {
		return this.#item;
	}
}

/**
 * Class returned by getUserList operation
 * @extends DataSetObject
 */
export class UserList extends DataSetObject {
	constructor(remoteAPI: RemoteAPI) {
		super(remoteAPI);
	}

	protected asJsonRpc() {
		const requestObject: JSONRPCNamedOperation = this.requestObject = {
			"#id": this.id,
			"@name": "api",
			"@func": [{"@name": "userlist"}]
		};

		return requestObject;
	}
}

/**
 * Class returned by consultRecent operations
 */
export class RecentList extends DataSetObject {
	/**
	 * @param remoteAPI 
	 * @param entity The entity name, e.g. "Comp"
	 * @param extraFields A list of extra fields to consult for each recent entity record, e.g. ["POSTCODE", "CITY"]
	 */
    constructor(remoteAPI: RemoteAPI, private entity: string, private extraFields: string[] = []) {
		super(remoteAPI);
		if (extraFields && !Array.isArray(extraFields)) throw TypeError("RecentListEx.constructor::extraFields is not an array");
	}

	protected asJsonRpc() {
		const api = {
			"@name": "recentlistex",
			"entity": this.entity,
			"extrafields": this.extraFields.join(","),
		}

		const requestObject: JSONRPCNamedOperation = this.requestObject = {
			"#id": this.id,
			"@name": "api",
			"@func": [api]
		};

		return requestObject;
	}
}

/**
 * Class returned by consultFavorites operations
 */
export class FavoriteList extends DataSetObject {
	/**
	 * @param remoteAPI 
	 * @param entity The entity name, e.g. "Comp"
	 */
	constructor(remoteAPI: RemoteAPI, private entity: string) {
		super(remoteAPI);
	}

	protected asJsonRpc() {
		const api = {
			"@name": "favoritelist",
			"entity": this.entity
		}

		const requestObject: JSONRPCNamedOperation = this.requestObject = {
			"#id": this.id,
			"@name": "api",
			"@func": [api]
		};

		return requestObject;
	}
}

/**
 * Class returned by searchContactsByEmail, searchContactsByPhone operations
 */
export class ContactsList extends DataSetObject {
	/**
	 * @param remoteAPI 
	 * @param recipients The list of email addresses
	 * @param phoneNumber The phone number, doesn't have to be stripped from formatting
	 */
	constructor(remoteAPI: RemoteAPI, private recipients: string[] = [], private phoneNumber: string = "") {
		super(remoteAPI);
	}

	protected asJsonRpc() {
		let api;

		if (Array.isArray(this.recipients) && this.recipients.length > 0) {
			api = {
				"@name": "contactidsfromemailaddresses",
				"recipients": this.recipients.join(";")
			}
		} else if (this.phoneNumber) {
			api = {
				"@name": "searchcontactsbyphone",
				"phonenumber": this.phoneNumber
			}
		}

		if (!api) throw Error("ContactsList.asJsonRpc::unable to define the operation @name");

		const requestObject: JSONRPCNamedOperation = this.requestObject = {
			"#id": this.id,
			"@name": "api",
			"@func": [api]
		};

		return requestObject;
	}
}

/**
 * Class returned by consultManyEx operations
 */
export class ConsultManyEx extends DataSetObject {
	/**
	 * @param remoteAPI 
	 * @param entity The entity name, e.g. "Comp"
	 * @param whereFields A list of field names to match (used as WHERE criteria), e.g. ["NAME", "OPENED"]
	 * @param whereValues A list of values to match, e.g. ["Efficy", "1"]
	 * @param orderByExpression SQL sort expression, e.g. "K_COMPANY desc"
	 */
	constructor(remoteAPI: RemoteAPI, private entity: string, private whereFields: string[] = [], private whereValues: string[] = [], private orderByExpression: string = "") {
		super(remoteAPI);
	}

	protected asJsonRpc() {
		const api = {
			"@name": "consultmanyex",
			"entity": this.entity,
			"findfield": this.whereFields.join(";"),
			"keys": this.whereValues.join(";"),
			"orderbyfield": this.orderByExpression,
			"separator": ";"
		}

		const requestObject: JSONRPCNamedOperation = this.requestObject = {
			"#id": this.id,
			"@name": "api",
			"@func": [api]
		};

		return requestObject;
	}
}

/**
 * Class returned by methods such as getCategoryCollection
 */
export class CollectionObject extends DataSetObject {
	constructor(remoteAPI: RemoteAPI, private entity: string, private detail: string) {
		super(remoteAPI);
		this.dataSetName = "collection";
	}

	protected asJsonRpc() {
		const api: JSONPrimitiveObject = {
			"@name": "getcategorycollection"
		}

		if (this.entity) api.entity = this.entity;
		if (this.detail) api.detail = this.detail;

		const requestObject: JSONRPCNamedOperation = {
			"#id": this.id,
			"@name": "api",
			"@func": [api]
		};

		return requestObject;
	}
}