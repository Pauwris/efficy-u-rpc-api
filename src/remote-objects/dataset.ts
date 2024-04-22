import { RemoteObject } from './remote-object.js';
import { JSONPrimitiveObject, JSONRPCNamedOperation } from '../types/index.js'
import RemoteAPI from 'src/remote-api.js';

export type DataSetKind = "main" | "master" | "detail" | "category";

class DataSetInternal {
	tableView: number = 0;
	protected ds: DataSetInternal | null = null;

	private _items: JSONPrimitiveObject[] = [];
	private _item: JSONPrimitiveObject | null = null;

	constructor(public type: DataSetKind, public name: string, public filter?: string, public includeBlobContent?: boolean) {
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

		this._items = value;
		if (this._items.length > 0) {
			this._item = this._items[0];
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

	get remoteDataSet(): DataSet {
		return new DataSet(this);
	}
}

export class DataSet {
	constructor(public ds: DataSetInternal | null) {}

	/**
	 * The to array converted dataset
	 */
	get items() {
		return this.ds ? this.ds.items : [];
	}

	/**
	 * When exists, the first item of the items, else null
	 */
	get item() {
		return this.ds ? this.ds.item : null;
	}
}

export class RemoteDataSet extends RemoteObject {
	protected ds: DataSetInternal | null = null;

	constructor(remoteAPI: RemoteAPI) {
		super(remoteAPI);
		this.api.registerObject(this);
	}

	protected dataSetName?: string;

	protected afterExecute() {
		super.afterExecute();

		this.ds = new DataSetInternal("main", "main");
		this.ds.setItems(this.api.findDataSetArray(this.responseObject, this.dataSetName));
	}

	/**
	 * The to array converted dataset
	 */
	get items() {
		return this.ds ? this.ds.items : [];
	}

	/**
	 * When exists, the first item of the items, else null
	 */
	get item() {
		return this.ds ? this.ds.item : null;
	}
}

class DataSetTableView {
	category: DataSetInternal[] = []
	detail: DataSetInternal[] = []
}

/**
 * Groups a list of DataSet operations that are shared between ConsultObject and EditObject
 */
export class DataSetList extends RemoteObject {
	private master: DataSetInternal | null = null;
	private master1: DataSetInternal | null = null;
	private tableView: DataSetTableView = new DataSetTableView();

	constructor(remoteAPI: RemoteAPI) {
		super(remoteAPI);
		this.resetState();
	}

	/**
	 * Retrieves a master DataSet from the edit context.
	 */
	getMasterDataSet(masterView = 0): DataSetInternal {
		if (masterView > 0) {
			this.master1 = new DataSetInternal("master", "master", undefined, undefined);
			this.master1.tableView = 1;
			return this.master1;
		} else {
			this.master = new DataSetInternal("master", "master", undefined, undefined);
			return this.master;
		}
	}

	/**
	 * Retrieves the DataSet for category categoryName. Can be null when the category is not available to the current user.
	 * @param categoryName name of the category, e.g. "DOCU$INVOICING"
	 */
	getCategoryDataSet(categoryName: string): DataSetInternal {
		const ds = new DataSetInternal("category", categoryName);
		this.tableView.category.push(ds)

		return ds;
	}

	/**
	 * Retrieves a relation DataSet for the specified detail in the edit context.
	 * @param detail The detail name, e.g. "Comp"
	 * @param filter SQL filter expression, e.g. "COMMENT like '%template%'"
	 * @param includeBlobContent If true, blob fields (e.g. memo, stream) are returned
	 */
	getDetailDataSet(detail: string, filter: string = "", includeBlobContent: boolean = false): DataSetInternal {
		const ds = new DataSetInternal("detail", detail, filter, includeBlobContent);
		this.tableView.detail.push(ds)

		return ds;
	}

	resetState() {
		this.master = null;
		this.master1 = null;
		this.tableView = new DataSetTableView();
	}

	get funcs() {
		const array = [];

		this.master && array.push(this.master.func);
		this.master1 && array.push(this.master1.func);

		[...this.tableView.category, ...this.tableView.detail].forEach(ds => {
			array.push(ds.func)
		})

		return array;
	}

	afterExecute() {
		this.master && this.setDsoItems(this.master);
		this.master1 && this.setDsoItems(this.master1);

		[...this.tableView.category, ...this.tableView.detail].forEach(ds => {
			this.setDsoItems(ds)
		})
	}

	setResponseObject(value: object) {
		this.responseObject = value;
	}

	/**
	 * Add the remotely fetched master, categories and detail data as properties of data
	 */
	setData(target: any) {
		target.data = {};
		target.data.master = this.master?.item;
		target.data.master1 = this.master1?.item;
	}

	private setDsoItems(dso: DataSetInternal) {
		if (dso.tableView > 0) {
			const item = this.api.findFuncArray2(this.responseObject, dso.type, "tableview", dso.tableView);
			if (item) dso.setItems(item);
		} else {
			const item = this.api.findFuncArray2(this.responseObject, dso.type, dso.type, dso.name);
			if (item) dso.setItems(item);
		}
	}
}

/**
 * Class returned by getUserList operation
 * @extends RemoteDataSet
 */
export class UserList extends RemoteDataSet {
	constructor(remoteAPI: RemoteAPI) {
		super(remoteAPI);
	}

	protected asJsonRpc() {
		const requestObject: JSONRPCNamedOperation = this.requestObject = {
			"#id": this.id,
			"@name": "api",
			"@func": [{ "@name": "userlist" }]
		};

		return requestObject;
	}
}

/**
 * Class returned by consultRecent operations
 */
export class RecentList extends RemoteDataSet {
	/**
	 * @param remoteAPI 
	 * @param entity The entity name, e.g. "Comp"
	 * @param extraFields A list of extra fields to consult for each recent entity record, e.g. ["POSTCODE", "CITY"]
	 */
	constructor(remoteAPI: RemoteAPI, private entity: string, private extraFields: string[] = []) {
		super(remoteAPI);
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
export class FavoriteList extends RemoteDataSet {
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
export class ContactsList extends RemoteDataSet {
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
export class ConsultManyEx extends RemoteDataSet {
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
export class CollectionObject extends RemoteDataSet {
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