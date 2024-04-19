import { RemoteObject } from './remote-object.js';
import { JSONPrimitiveObject } from '../types/index.js'
import RemoteAPI from 'src/remote-api.js';

export type DataSetKind = "main" | "master" | "detail" | "category";

export class DataSet {
	tableView: number = 0;

	private _items: any[] = [];
    private _item: any;

	constructor(public type: DataSetKind, public name?: string, public filter?:string, public includeBlobContent?: boolean) {
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

	setItems(value: JSONPrimitiveObject) {
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
 * @extends RemoteObject
 */
export class DataSetObject extends RemoteObject {
	#items: any;
	#item: any;

	constructor(remoteAPI: RemoteAPI) {
		super(remoteAPI);
		this.api.registerObject(this);
	}

	protected dataSetName?: string;

	afterExecute() {
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
	 * When exists, the first item of the items array, else null
	 */
	get item() {
		return this.#item;
	}
}