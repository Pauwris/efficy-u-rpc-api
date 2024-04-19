import CrmEnv from './crm-env.js';
import RemoteAPI from './remote-api.js';
import { PropertyObject, SettingObject } from './remote-objects/base-type.js';
import { CollectionObject, ConsultManyEx, FavoriteList, RecentList, UserList } from './remote-objects/dataset.js';
import { SystemSettings } from './remote-objects/list-type.js';
import { QueryObject, QuerySQLObject } from './remote-objects/query.js';
/**
 * Class to create Remote Objects
 * @extends RemoteAPI
*/
class CrmRpc extends RemoteAPI {
	/**
	 * Construct a CrmRpc object
	 * @param crmEnv When empty, uses the Efficy context of the browser
	 * @param logFunction  Your (custom) log function to call for requests and responses, e.g. console.log
	 * @param threadId Unique thread ID for logging purposes
	 * @example
	 * function logger(msg, reqLog) {
	 *   console.log(msg);
	 * }
	 * const crm = new CrmRpc(crmEnv, logger);
	 */
	constructor(crmEnv?: CrmEnv, logFunction?: Function, threadId?: number) {
		super(crmEnv, logFunction, threadId);
	}

	/**
	 * Execute all assembled and queued RPC operations
	 */
	async executeBatch() {
		return super.executeBatch();
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
		return super.post(requestUrl, requestObject);
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
		return new ConsultManyEx(this, entity, whereFields, whereValues, orderByExpression);
	}

	/**
	 * Consult your recent records, optionally extended by additional fields.
	 * @param entity The entity name, e.g. "Comp"
	 * @param extraFields A list of extra fields to consult for each recent entity record, e.g. ["POSTCODE", "CITY"]
	 * @example
	 * const compRecents = crm.consultRecent("Comp");
	 * const compRecentsEx = crm.consultRecent("Comp", ["CITY", "COUNTRY"]);
	 */
	consultRecent(entity: string, extraFields: string[] = []) {
		return new RecentList(this, entity, extraFields);
	}

	/**
	 * Consult your favorite records.
	 * @param entity The entity name, e.g. "Comp"
	 * @example
	 * const compFavorites = crm.consultFavorites("Comp");
	 */
	consultFavorites(entity: string) {
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
	 * @param queryParameters The query parameters delivered via a JS Array
	 * @param loadBlobs If true, blob fields (e.g. memo, stream) are returned
	 * @param recordCount If 0, return all records
	 * @example
	 * const tags = crm.executeDatabaseQuery(99990034); // Query "Standard: Top company tags"
	 */
	executeDatabaseQuery(idQuery: string, queryParameters?: string[], loadBlobs: boolean = false, recordCount: number = 0) {
		return new QueryObject(this, idQuery, undefined, undefined, queryParameters, loadBlobs, recordCount);
	}

	executeSystemQuery(master: number, detail: number, queryParameters?: string[], loadBlobs: boolean = false, recordCount: number = 0) {
		return new QueryObject(this, undefined, master, detail, queryParameters, loadBlobs, recordCount);
	}

	/**
	 * Runs a native (SQL) database query, only if the user has SQL Exec the permissions!
	 * @param sqlQueryText The SQL query text
	 * @param queryParameters The query parameters delivered via a JS Array
	 * @param loadBlobs If true, blob fields (e.g. memo, stream) are returned
	 * @param recordCount Limit the returned records
	 */
	executeSqlQuery(sqlQueryText: string, queryParameters?: string[], loadBlobs: boolean = false, recordCount: number = 0) {
		return new QuerySQLObject(this, sqlQueryText, queryParameters, loadBlobs, recordCount);
	}	

	/**
	 * Efficy U constants
	 */
	readonly constants = {
		account_kind: {
			user: 0,
			group: 1,
			resource: 2,
			team: 3
		},
		file_type: {
			embedded: 1,
			linked: 2,
			remote: 4,
			large: 5
		},
		access_code: {
			search: 1,
			read: 2,
			write: 4,
			delete: 8,
			showcontent: 16,
			addcontent: 32,
			modifycontent: 64,
			deletecontent: 128,
			secure: 256,
			fullcontrol: 271,
			securecontent: 512,
			nocontent: 2048
		}
	}
}

export default CrmRpc;