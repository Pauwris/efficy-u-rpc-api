import CrmEnv from './crm-env.js';
import RemoteAPI from './remote-api.js';
import { QuerySQLObject } from './remote-objects/query.js';
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
	 * Runs a native (SQL) database query, only if the user has SQL Exec the permissions!
	 * @param sqlQueryText The SQL query text
	 * @param queryParameters The query parameters delivered via a JS Array
	 * @param loadBlobs If true, blob fields (e.g. memo, stream) are returned
	 * @param recordCount Limit the returned records
	 */
	executeSqlQuery(sqlQueryText: string, queryParameters: string[], loadBlobs: boolean = false, recordCount: number = 0) {
		return new QuerySQLObject(this, sqlQueryText, queryParameters, loadBlobs, recordCount);
	}	

	/**
	 * Efficy U constants
	 * @readonly
	 * @enum {object}
	 */
	constants = {
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