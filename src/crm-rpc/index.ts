import { CrmEnv } from '../crm-env.js';
import { PropertyObject, SettingObject } from './rpc-objects/base-type.js';
import { ConsultObject } from './rpc-objects/consult.js';
import { CollectionObject, ConsultManyObject, FavoriteList, RecentList, UserList } from './rpc-objects/dataset.js';
import { EditObject, DeleteEntity } from './rpc-objects/edit.js';
import { SystemSettings } from './rpc-objects/list-type.js';
import { QueryObject, QuerySQLObject } from './rpc-objects/query.js';
import { UnityKey } from '../types.js';
import { CrmFetch } from '../crm-fetch.js';
import { RpcObject } from './rpc-objects/rpc-object.js';
import { RpcNamedOperation } from './types.js';
import { isRPCNamedOperation } from '../dataguards.js';
import * as RpcConstants from "./constants.js";
export * as CrmRpcObjects from "./rpc-objects/index.js"

/**
 * @private
 */
export class JsonRpcApi extends CrmFetch {
	remoteObjects: RpcObject[] = [];


	constructor(public crmEnv = new CrmEnv()) {
		super(crmEnv)
		this.name = "JsonRpcApi";
	}

	/**
	 * Execute all assembled and queued RPC operations
	 */
	async executeBatch() {
		const requestObject: RpcNamedOperation[] = [];

		try {
			this.remoteObjects.forEach(item => {
				// @ts-expect-error using protected member
				const jsonRPC = item.asJsonRpc();
				if (jsonRPC) {
					requestObject.push(jsonRPC);
				}
			})
		} catch (e) {
			this.remoteObjects.length = 0;
			throw new Error(`${this.name}.executeBatch::asJsonRpc\n${e.message}`)
		}

		// Nothing to execute, ignore silently
		if (!requestObject.length) return;

		try {
			const responseOperations: RpcNamedOperation[] = await this.fetchPost(requestObject);

			// Add response info to operations and remove executed operations (handled or not)
			const items = this.remoteObjects;
			let index = items.length
			while (index--) {
				const operation = items[index];
				const respOper = responseOperations.find(respOper => {
					// @ts-expect-error using protected member
					return respOper["#id"] === operation.id;
				});
				if (!respOper)
					throw new Error(`${this.name}.executeBatch::cannot find response for queued operation [${index}/${items.length}]`);
				// @ts-expect-error using protected method
				Object.assign(operation.responseObject, respOper);
				// @ts-expect-error using protected method
				operation.afterExecute();
				items.splice(index, 1);
			}
		} finally {
			this.remoteObjects.length = 0;
		}
	}

	/**
	 * Logoff the remote session
	 */
	logoff() {
		this.crmEnv.logOff = true;
		this.setFetchOptions();
	}

	private async fetchPost(requestObject: object): Promise<RpcNamedOperation[]> {
		this.initJsonFetch("POST");
		const responseOperations: RpcNamedOperation[] = [];
		const requestUrl = `${this.crmEnv.url}/crm/json${this.crmEnv.customer ? "?customer=" + encodeURIComponent(this.crmEnv.customer) : ""}`;

		const requestOptions: RequestInit = {
            body: JSON.stringify(requestObject)
        }

		const response: object = await this.fetch(requestUrl, requestOptions)

		if (Array.isArray(response)) {
			response.forEach(item => {
				if (isRPCNamedOperation(item)) {
					responseOperations.push(item);
				}
			})
		} else if (!response) {
			throw new Error(`${this.name}.fetchPost::empty response`);
		} else {
			throw new Error(`${this.name}.fetchPost::responseObject is not an Array`);
		}

		return responseOperations;
	}
}

/**
 * Efficy SDK build around JSON RPC operations send to endpoint "crm/json", the Efficy Enterprise product style.
 * Multiple RPC operations can be registered in a single request until usage of method executeBatch().
 * Only after this method was executed, the RPC Response objects have data available in their item and items attributes.
 * @example
 * const crm = new CrmRpc(crmEnv);
 * const comp = crm.openConsultObject("comp", compKey);
 * const dsComp = comp.getMasterDataSet();
 * const dsCompCustomer = comp.getCategoryDataSet("COMP$CUSTOMER");
 * const dsLinkedContacts = comp.getDetailDataSet("cont");
 * await crm.executeBatch();
 * const compName = dsComp.item?.compName;
 */
export class CrmRpc extends JsonRpcApi {
	/**
	 * Construct a CrmRpc object
	 * @param [crmEnv] When empty, uses the Efficy context of the browser
	 * @example
	 * const crm = new CrmRpc(crmEnv);
	 */
	constructor(crmEnv?: CrmEnv) {
		super(crmEnv);
	}

	/**
	 * Execute all assembled and queued RPC operations
	 */
	async executeBatch() {
		return await super.executeBatch();
	}
	/**
	 * Logoff the remote session
	 */
	logoff() {
		return super.logoff();
	}

	/**
	 * Post and receive JSON with custom endpoint
	 */
	post(requestUrl: string, requestObject: object) {
		return super.fetch(requestUrl, requestObject);
	}

	/**
	 * Retrieves the alias (name) of the currently connected database
	 */
	get currentDatabaseAlias() {
		return new PropertyObject(this, "currentdatabasealias");
	}

	/**
	 * Retrieves the current license name
	 */
	get currentLicenseName() {
		return new PropertyObject(this, "currentlicensename");
	}

	/**
	 * Retrieves the current user full name
	 */
	get currentUserFullName() {
		return new PropertyObject(this, "currentuserfullname");
	}

	/**
	 * Retrieves the group memberships of the current user as semicolon separated string list, e.g. "1;28;292;936"
	 */
	get currentUserGroups() {
		return new PropertyObject(this, "currentusergroups");
	}

	/**
	 * Retrieves the current user key
	 */
	get currentUserId() {
		return new PropertyObject(this, "currentuserid");
	}

	/**
	 * Retrieves the current user code, e.g. "CRM01"
	 */
	get currentUserCode() {
		return new PropertyObject(this, "currentusername");
	}

	/**
	 * Retrieves the current user timezone
	 */
	get currentUserTimezone() {
		return new PropertyObject(this, "currentusertimezone");
	}

	/**
	 * Request a list of system settings. Use the Map object to retrieve settings
	 * @example
	 * const settings = crm.getSystemSettings();
	 * await crm.executeBatch();
	 * settings.map.get("ShortDateFormat"); // e.g. "dd/mm/yyyy"
	 * settings.map.forEach(console.log); // prints each setting on console
	 */
	getSystemSettings() {
		return new SystemSettings(this);
	}

	/**
	 * Requests the current value of a given Efficy setting.
	 * @param module The name of the setting.
	 * @param name The name of the module (JSON object) that owns the setting.
	 * @param asString If true, the settings of type TDateTime will be returned as a string formatted with the ShortDateTime format. If false, it will be returned as a float value.
	 * @example
	 * const workingPeriodFrom = crm.getSetting("user", "WorkingPeriodFrom");
	 * const workingPeriodFromFloat = crm.getSetting("user", "WorkingPeriodFrom", false);
	 * await crm.executeBatch();
	 * workingPeriodFrom.result; // e.g. "30/12/1899 08:00"
	 * workingPeriodFromFloat.result; // e.g. "0.333333333333333
	 */
	getSetting(module: string, name: string, asString = true) {
		return new SettingObject(this, module, name, asString);
	}

	/**
	 * Opens a consult context for the record identified by entity and key.
	 * A context remains memory-resident (on the web server) until it is closed. Always match with a closeContext() call to avoid memory consumption.
	 * @param entity The entity name, e.g. "Comp"
	 * @param key The key of the record. Use key = "" to create a new record.
	 * @example
	 * const comp = crm.openConsultObject("comp", compKey)
	 * const dsComp = comp.getMasterDataSet();
	 * const dsCompCustomer = comp.getCategoryDataSet("COMP$CUSTOMER");
	 * const linkedContacts = comp.getDetailDataSet("cont");
	 * await crm.executeBatch();
	 */
	openConsultObject(entity: string, key: UnityKey) {
		return new ConsultObject(this, entity, key);
	}

	/**
	 * Opens an edit context for the record identified by entity and key.
	 * A context remains memory-resident (on the web server) until it is closed. Always match with a closeContext() call to avoid memory consumption.
	 * @param entity - The entity name, e.g. "Comp"
	 * @param key - The key of the record. Use key = "" to create a new record.
	 */
	openEditObject(entity: string, key: UnityKey = "") {
		return new EditObject(this, entity, key);
	}



	/**
	 * @deprecated
	 * Selects records that exactly match certain field values
	 * @param entity The entity name, e.g. "Comp"
	 * @param whereFields A list of field names to match (used as WHERE criteria), e.g. ["NAME", "OPENED"]
	 * @param whereValues A list of values to match, e.g. ["Efficy", "1"]
	 * @param orderByExpression SQL sort expression, e.g. "K_COMPANY desc"
	 * @example
	 * const morningMeetings = crm.consultManyEx("Acti", ["PLANNED", "D_BEGIN"], ["1", "2022-03-14 09:00:00"], "D_BEGIN");
	 */
	consultManyEx(entity: string, whereFields: string[] = [], whereValues: string[] = [], orderByExpression: string = "") {
		return new ConsultManyObject(this, entity, whereFields, whereValues, orderByExpression);
	}

	/**
	 * Consult your recent records, optionally extended by additional fields.
	 * @param [entity] The entity name, e.g. "Comp"
	 * @param [extraFields] A list of extra fields to consult for each recent entity record, e.g. ["POSTCODE", "CITY"]
	 * @example
	 * const compRecents = crm.consultRecent("Comp");
	 * const compRecentsEx = crm.consultRecent("Comp", ["CITY", "COUNTRY"]);
	 */
	consultRecent(entity: string = "", extraFields: string[] = []) {
		return new RecentList(this, entity, extraFields);
	}

	/**
	 * Consult your favorite records.
	 * @param [entity] The entity name, e.g. "Comp"
	 * @example
	 * const compFavorites = crm.consultFavorites("Comp");
	 */
	consultFavorites(entity?: string) {
		return new FavoriteList(this, entity);
	}

	/**
	 * Request the accessible categories - for the current user - of the given entity
	 * @param {string} entity - The entity name, e.g. "Comp"
	 * @example
	 * const compCategories = crm.getCategoryCollection("comp");
	 */
	getCategoryCollection(entity: string) {
		const detail = "";
		return new CollectionObject(this, entity, detail);
	}

	/**
	 * Requests a list of users, groups and resources
	 * @example
	 * const userList = crm.getUserList();
	 */
	getUserList() {
		return new UserList(this);
	}

	/**
	 * Executes a database query stored in QUERIES
	 * @param idQuery
	 * @param [queryParameters] The query parameters delivered via a JS Array
	 * @param [loadBlobs] If true, blob fields (e.g. memo, stream) are returned
	 * @param [recordCount] If 0, return all records
	 * @example
	 * const tags = crm.executeDatabaseQuery(99990034); // Query "Standard: Top company tags"
	 */
	executeDatabaseQuery(idQuery: UnityKey, queryParameters?: string[], loadBlobs: boolean = false, recordCount: number = 0) {
		return new QueryObject(this, idQuery, undefined, undefined, queryParameters, loadBlobs, recordCount);
	}

	executeSystemQuery(master: number, detail: number, queryParameters?: string[], loadBlobs: boolean = false, recordCount: number = 0) {
		return new QueryObject(this, undefined, master, detail, queryParameters, loadBlobs, recordCount);
	}

	/**
	 * Runs a native (SQL) database query, only if the user has SQL Exec the permissions!
	 * @param sqlQueryText The SQL query text
	 * @param [queryParameters] The query parameters delivered via a JS Array
	 * @param [loadBlobs] If true, blob fields (e.g. memo, stream) are returned
	 * @param [recordCount] Limit the returned records
	 */
	executeSqlQuery(sqlQueryText: string, queryParameters?: string[], loadBlobs: boolean = false, recordCount: number = 0) {
		return new QuerySQLObject(this, sqlQueryText, queryParameters, loadBlobs, recordCount);
	}

	/**
	 * Deletes records
	 * @param entity The entity name, e.g. "Comp"
	 * @param keys List of keys
	 */
	deleteEntity(entity: string, keys: UnityKey[]) {
		if (!keys || (Array.isArray(keys) && keys.length === 0)) return;
		new DeleteEntity(this, entity, keys);
	}

	/* The statement `constants = RpcConstants` failed in build:dts process, hence this manual export */
	constants = {
		access_code: RpcConstants.access_code,
		account_kind: RpcConstants.account_kind,
		file_type: RpcConstants.file_type,
	};
}
