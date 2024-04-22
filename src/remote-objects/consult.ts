import { RemoteAPI } from "src/remote-api.js";
import { RemoteObject } from "./remote-object.js";
import { DataSetList, DataSet } from "./dataset.js";
import { JSONRPCNamedOperation, UKey } from "src/types.js";

/**
 * Class returned by openConsultObject
 */
export class ConsultObject extends RemoteObject {
	private dataSetList;
	private isDirty: boolean = false;
	

	/**
	 * Opens an consult context for the record identified by entity and key.
	 * @param remoteAPI 
	 * @param entity The entity name of the consulted record, e.g. "Comp"
	 * @param key The key of the consulted record
	 */
	constructor(remoteAPI: RemoteAPI, public entity: string, public key: UKey) {
		super(remoteAPI);
		this.dataSetList = new DataSetList(remoteAPI);

		this.resetState();
		this.setDirty();
	}

	/**
	 * resetState and isDirty allows to reuse the existing class after an executeBatch
	 */
	private resetState() {
		this.dataSetList.resetState();
		this.isDirty = false;
	}
	private setDirty() {
		if (this.isDirty) return;
		this.registerObject(this);
		this.isDirty = true;
	}

	/**
	 * Retrieves a master DataSet from the consult context.
	 */
	getMasterDataSet(): DataSet {
		this.setDirty();
		return this.dataSetList.getMasterDataSet().remoteDataSet;
	}

	/**
	 * Retrieves the DataSet for category categoryName. Can be null when the category is not available to the current user.
	 * @param {string} categoryName - name of the category, e.g. "DOCU$INVOICING"
	 */
	getCategoryDataSet(categoryName: string): DataSet {
		this.setDirty();
		return this.dataSetList.getCategoryDataSet(categoryName).remoteDataSet;
	}

	/**
	 * Retrieves a relation DataSet for the specified detail in the edit context.
	 * @param detail The detail name, e.g. "Comp"
	 * @param filter SQL filter expression, e.g. "COMMENT like '%template%'"
	 * @param includeBlobContent If true, blob fields (e.g. memo, stream) are returned
	 */
	getDetailDataSet(detail: string, filter = "", includeBlobContent = false): DataSet {
		this.setDirty();
		return this.dataSetList.getDetailDataSet(detail, filter, includeBlobContent).remoteDataSet;
	}

	protected asJsonRpc(): JSONRPCNamedOperation {
		const requestObject: JSONRPCNamedOperation = {
			"#id": this.id,
			"@name": "consult",
			"closecontext": true,
			"@func": []
		};

		if (this.entity) requestObject.entity = this.entity;
		if (this.key) requestObject.key = this.key;

		requestObject["@func"].push(...this.dataSetList.funcs);

		return requestObject;
	}

	protected afterExecute() {
		super.afterExecute();

		this.dataSetList.setResponseObject(this.responseObject);
		this.dataSetList.afterExecute();
		this.dataSetList.setData(this);

		this.resetState();
	}
}