import { RpcObject } from './rpc-object.js';
import { JSONPrimitiveObject } from '../../types.js'
import { RpcNamedOperation } from '../../types.js'
import { JsonRpcApi } from 'src/crm-rpc/index.js';

type DataSetKind = "main" | "master" | "detail" | "category";

class DataSetInternal {
	tableView: number = 0;

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
	}

	get remoteDataSet(): DataSet {
		return new DataSet(this);
	}
}

export class DataSet {
	constructor(public ds: DataSetInternal | null) {}

	get name() {
		return this.ds?.name;
	}
	get type() {
		return this.ds?.type;
	}
	get filter() {
		return this.ds?.filter;
	}
	get includeBlobContent() {
		return this.ds?.includeBlobContent;
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

export class RemoteDataSet extends RpcObject {
	protected ds: DataSetInternal | null = null;

	constructor(remoteAPI: JsonRpcApi) {
		super(remoteAPI);
		this.registerObject(this);
	}

	protected dataSetName?: string;

	protected afterExecute() {
		super.afterExecute();

		this.ds = new DataSetInternal("main", "main");
		this.ds.setItems(this.findDataSetArray(this.responseObject, this.dataSetName));
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
export class DataSetList extends RpcObject {
	private master: DataSetInternal | null = null;
	private master1: DataSetInternal | null = null;
	private tableView: DataSetTableView = new DataSetTableView();

	constructor(remoteAPI: JsonRpcApi) {
		super(remoteAPI);
		this.resetState();
	}

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

	getCategoryDataSet(categoryName: string): DataSetInternal {
		const ds = new DataSetInternal("category", categoryName);
		this.tableView.category.push(ds)

		return ds;
	}

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
			const item = this.findFuncArray2(this.responseObject, dso.type, "tableview", dso.tableView);
			if (item) dso.setItems(item);
		} else {
			const item = this.findFuncArray2(this.responseObject, dso.type, dso.type, dso.name);
			if (item) dso.setItems(item);
		}
	}
}

/**
 * Class returned by getUserList operation
 */
export class UserList extends RemoteDataSet {
	constructor(remoteAPI: JsonRpcApi) {
		super(remoteAPI);
	}

	protected asJsonRpc() {
		const requestObject: RpcNamedOperation = this.requestObject = {
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
	constructor(remoteAPI: JsonRpcApi, private entity: string = "", private extraFields: string[] = []) {
		super(remoteAPI);
	}

	protected asJsonRpc() {
		const api: JSONPrimitiveObject = {
			"@name": "recentlistex",
			"extrafields": this.extraFields.join(","),
		}

		if (this.entity) api.entity = this.entity;

		const requestObject: RpcNamedOperation = this.requestObject = {
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
	constructor(remoteAPI: JsonRpcApi, private entity?: string) {
		super(remoteAPI);
	}

	protected asJsonRpc() {
		const api: JSONPrimitiveObject = {
			"@name": "favoritelist"		
		}

		if (this.entity) api.entity = this.entity;

		const requestObject: RpcNamedOperation = this.requestObject = {
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
	constructor(remoteAPI: JsonRpcApi, private recipients: string[] = [], private phoneNumber: string = "") {
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

		const requestObject: RpcNamedOperation = this.requestObject = {
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
export class ConsultManyObject extends RemoteDataSet {
	constructor(remoteAPI: JsonRpcApi, private entity: string, private whereFields: string[] = [], private whereValues: string[] = [], private orderByExpression: string = "") {
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

		const requestObject: RpcNamedOperation = this.requestObject = {
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
	constructor(remoteAPI: JsonRpcApi, private entity: string, private detail: string) {
		super(remoteAPI);
		this.dataSetName = "collection";
	}

	protected asJsonRpc() {
		const api: JSONPrimitiveObject = {
			"@name": "getcategorycollection"
		}

		if (this.entity) api.entity = this.entity;
		if (this.detail) api.detail = this.detail;

		const requestObject: RpcNamedOperation = {
			"#id": this.id,
			"@name": "api",
			"@func": [api]
		};

		return requestObject;
	}
}