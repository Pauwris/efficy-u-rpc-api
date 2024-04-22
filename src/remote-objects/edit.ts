import RemoteAPI from "src/remote-api.js";
import { RemoteObject } from "./remote-object.js";
import { DataSetList, DataSet } from "./dataset.js";
import { JSONPrimitiveObject, JSONRPCNameObject, JSONRPCNamedOperation, UKey } from "src/types/index.js";
import { AttachmentList, AttachmentObject } from "./attachment.js";

/**
 * Constructed class Returned by RemoteObjects.openEditObject
 */
export class EditObject extends RemoteObject {
	protected commit: boolean = true;
    protected closecontext: boolean = true;

	masterData: Record<string, string | number> = {};	
	otherFuncs: object[] = [];
    categories: Map<string, JSONPrimitiveObject> = new Map();
	
	private attachmentList: AttachmentList;
    private dataSetList;
	private isDirty: boolean =false;

    /**
     * Opens an edit context for the record identified by entity and key.
     * @param remoteAPI 
     * @param entity The entity name, e.g. "Comp"
     * @param key The key of the record. Use key = 0 to create a new record
     */
	constructor(remoteAPI: RemoteAPI, public entity: string, public key: UKey) {
		super(remoteAPI);
		this.dataSetList = new DataSetList(remoteAPI);
		this.attachmentList = new AttachmentList(remoteAPI);

		this.resetState();
		this.setDirty();
	}

	private resetState() {
		this.masterData = {};
		this.categories = new Map();
		this.otherFuncs = [];

		this.dataSetList.resetState();
		this.attachmentList.resetState();
		this.isDirty = false;
	}
	private setDirty() {
		if (this.isDirty) return;
		this.api.registerObject(this);
		this.isDirty = true;
	}

	/**
	 * Retrieves a master DataSet from the edit context.
	 */
	getMasterDataSet(): DataSet {
		this.setDirty();
		return this.dataSetList.getMasterDataSet().remoteDataSet;
	}

	/**
	 * Retrieves the DataSet for category categoryName. Can be null when the category is not available to the current user.
	 * @param categoryName name of the category, e.g. "DOCU$INVOICING"
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
	getDetailDataSet(detail: string, filter: string = "", includeBlobContent: boolean = false): DataSet {
		this.setDirty();
		return this.dataSetList.getDetailDataSet(detail, filter, includeBlobContent).remoteDataSet;
	}

	/**
	 * Request attachment from File table
	 */
	getAttachment(fileKey: UKey): AttachmentObject {
		this.setDirty();
		return this.attachmentList.getAttachment(fileKey);
	}

	/**
	 * Updates the field values of a master data set
	 */
	updateField(name: string, value: string | number) {
		this.masterData[name] = value;
		this.setDirty();
	}
	/**
	 * Updates the field values of a master data set.
	 * @param fieldsObj - e.g. {"archived": "1"}
	 */
	updateFields(fieldsObj: JSONPrimitiveObject) {
		Object.assign(this.masterData, fieldsObj);
		this.setDirty();
	}

	/**
	 * Updates the value of a field of any type in a category data set
	 */
	updateCategoryField(categoryName: string, name: string, value: string | number) {
		if (typeof categoryName !== "string") throw new TypeError("EditObject.updateCategoryField::categoryName is not a string");
        
        this.categories.set(categoryName, {name: value})
		this.setDirty();
	}

	/**
	 * Updates the value of a field of any type in a category data set
	 * @param categoryName
	 * @param fieldsObj e.g. {"name": "value"}
	 */
	updateCategoryFields(categoryName: string, fieldsObj: JSONPrimitiveObject) {
		if (typeof categoryName !== "string") throw new TypeError("EditObject.updateCategoryFields::categoryName is not a string");

        this.categories.set(categoryName, fieldsObj)
		this.setDirty();
	}

	/**
	 * Inserts a detail relation
	 */
	insertDetail(detail: string, detailKey: UKey, linkMainCompany = false, retrieveName = false) {
		if (typeof detail !== "string") throw new TypeError("EditObject.insertDetail::detail is not a string");

		const obj: JSONPrimitiveObject = {
			"@name": "insertDetail",
			"detail": detail,
			"detailkey": detailKey
		}
		if (typeof linkMainCompany === "boolean" && linkMainCompany) obj.maincomp = linkMainCompany;
		if (typeof retrieveName === "boolean" && retrieveName) obj.retrieveName = retrieveName;

		this.otherFuncs.push(obj);
		this.setDirty();
	}

	/**
	 * Updates field values of a detail relation. When the detail relation doesn't exist, an exception is thrown.
	 * @param detail The detail name, e.g. "Comp"
	 * @param detailKey  The key of the detail. If detailKey is 0, the current detail record is used
	 * @param  fieldsObj e.g. {"OPENED": "0"}
	 */
	updateDetail(detail: string, detailKey: UKey, fieldsObj: JSONPrimitiveObject) {
		if (typeof detail !== "string") throw new TypeError("EditObject.updateDetail::detail is not a string");

		this.otherFuncs.push({
			"@name": "updateDetail",
			"detail": detail,
			"detailkey": detailKey,
			"@data": fieldsObj
		});
		this.setDirty();
	}

	/**
	 * Deletes a detail relation
	 * @param detail The detail name, e.g. "Comp"
	 * @param detailKey The key of the detail
	 */
	deleteDetail(detail: string, detailKey: UKey) {
		if (typeof detail !== "string") throw new TypeError("EditObject.deleteDetail::detail is not a string");

		this.otherFuncs.push({
			"@name": "deleteDetail",
			"detail": detail,
			"detailkey": detailKey
		});
		this.setDirty();
	}

	/**
	 * Clears all relations for the specified detail
	 * @param detail - The detail name, e.g. "Comp"
	 */
	clearDetail(detail: string) {
		if (typeof detail !== "string") throw new TypeError("EditObject.clearDetail::detail is not a string");

		this.otherFuncs.push({
			"@name": "clearDetail",
			"detail": detail
		});
		this.setDirty();
	}

	/**
	 * Activates a category. If the user does not have the appropriate rights on the category, an exception is thrown.
	 */
	activateCategory(categoryName: string) {
		if (typeof categoryName !== "string") throw new TypeError("EditObject.activateCategory::categoryName is not a string");

		this.otherFuncs.push({
			"@name": "activateCategory",
			"category": categoryName
		});
		this.setDirty();
	}

	/**
	 * Requests that a unique reference number be generated when committing.
	 */
	setReference(id: string) {
		if (!id) throw new TypeError("EditObject.setReference::id is required");

		this.otherFuncs.push({
			"@name": "reference",
			"id": id
		});
		this.setDirty();
	}

	/**
	 * Sets the user relations.
	 * @param users The array of user IDs (keys).
	 * @param clear If true, clears the current user selection.
	 */
	setUsers(users: UKey[], clear = false) {
		if (!Array.isArray(users)) throw new TypeError("EditObject.setUsers::users is not an Array");

		const obj: object = {
			"@name": "setusers",
			"users": users,
            "clear": clear
		}

		this.otherFuncs.push(obj);
		this.setDirty();
	}

	/**
	 * Sets the security for a user or group.
	 * @param userKey The user or group for which security is added.
	 * @param securityValue A sum of one or more of the following values: 1 (search), 2 (read), 4 (write), 8 (delete) and 256 (secure). Useful combinations are 7 (read/write), 15 (read/write/delete) and 271 (full control = read/write/delete/secure).
	 */
	setUserSecurity(userKey: UKey, securityValue: number) {
		if (!userKey) throw new TypeError("EditObject.setUserSecurity::account is required");
		if (typeof securityValue !== "number") throw new TypeError("EditObject.setUserSecurity::securityValue is not a number");

		this.otherFuncs.push({
			"@name": "setusersecurity",
			"user": userKey,
			"security": securityValue
		});
		this.setDirty();
	}

	/**
	 * Inserts an file
	 * @param attachedFileType 1 = embedded, 2 = linked, 4 = remote, 5 = large
	 * @param path The path of the file that will be saved in the filePath field.
	 */
	insertAttachment(attachedFileType: number, path: string) {
		if (typeof attachedFileType !== "number") throw new TypeError("EditObject.insertAttachment::attachedFileType is not a number");
		if (typeof path !== "string") throw new TypeError("EditObject.insertAttachment::path is not a string");

		this.otherFuncs.push({
			"@name": "insertAttachment",
			"type": attachedFileType,
			"path": path
		});
		this.setDirty();
	}

	/**
	 * Updates an embedded file
	 * @param key - Leave null or 0 to set the stream of the just inserted Attachment
	 * @param base64String
	 */
	updateAttachment(key: UKey | number, base64String: string) {
		if (typeof base64String !== "string") throw new TypeError("EditObject.updateAttachment::base64String is not a string");

		this.otherFuncs.push({
			"@name": "updateAttachment",
			"key": key,
			"encodingkind": "MIME64",
			"@data": base64String
		});
		this.setDirty();
	}

	/**
	 * Copies data from an existing record in the database. The same entity as the current is assumed.
	 * The table views within the index range minIndex to maxIndex are copied. By default, all table views are copied.
	 * To copy a single detail, obtain the table view index using IndexFromDetail and use this value as MinIndex and MaxIndex.
	 * @param key The key of the source record.
	 * @param minTableView The index of first table view to be copied.
	 * @param maxTableView The index of last table view to be copied.
	 */
	copyFromExisting(key: UKey, minTableView = 0, maxTableView = 999) {
		if (!key) throw new TypeError("EditObject.copyFromExisting::key is required");
		if (typeof minTableView !== "number") throw new TypeError("EditObject.copyFromExisting::minTableView is not a number");
		if (typeof maxTableView !== "number") throw new TypeError("EditObject.copyFromExisting::maxTableView is not a number");

		this.otherFuncs.push({
			"@name": "copyFromExisting",
			"key": key,
			"mintableview": minTableView,
			"maxtableview": maxTableView
		});
		this.setDirty();
	}

	/**
	 * Commits the changes to the database.
	 */
	commitChanges() {
		this.commit = true;
		this.setDirty();
	}


	protected asJsonRpc() {
		const requestObject: JSONRPCNamedOperation = {
			"#id": this.id,
			"@name": "edit",
			"@func": []
		};

        requestObject.entity = this.entity;
        requestObject.key = this.key;
        requestObject.commit = this.commit;
        requestObject.closecontext = true;

		requestObject["@func"].push(...this.otherFuncs);

        // Placed after this.otherFuncs, because they could have the activateCategory
        this.categories.forEach((categoryName, data) => {
            requestObject["@func"].push({
                "@name": "update",
                "category": categoryName,
                "@data": data
            })
        })

		requestObject["@func"].push(...this.dataSetList.funcs);
		requestObject["@func"].push(...this.attachmentList.funcs);

		if (typeof this.masterData === "object" && Object.keys(this.masterData).length > 0) {
			requestObject["@func"].push({
				"@name": "update",
				"@data": this.masterData
			})
		}

		return requestObject;
	}

	protected afterExecute() {
		super.afterExecute();
		
		const resp = this.responseObject as JSONPrimitiveObject;
        if (resp.key && typeof resp.key === "string") {
            this.key = resp.key as UKey;
        }        

		this.dataSetList.setResponseObject(this.responseObject);
		this.dataSetList.afterExecute();
		this.dataSetList.setData(this);

		this.attachmentList.setResponseObject(this.responseObject);
		this.attachmentList.afterExecute();

		this.resetState();
	}
}


/**
 * Class returned by methods such as deleteEntity
 */
export class DeleteEntity extends RemoteObject {
	constructor(remoteAPI: RemoteAPI, public entity: string, public keys: UKey[]) {
		super(remoteAPI);
		this.api.registerObject(this);
	}

	asJsonRpc() {
		const api = {
			"@name": "delete",
			"entity": this.entity,
			"keys": this.keys.join(";")
		}

		const requestObject: JSONRPCNamedOperation = {
			"#id": this.id,
			"@name": "api",
			"@func": [api]
		};

		return requestObject;
	}
}
