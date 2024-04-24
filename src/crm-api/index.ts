import { CrmEnv } from '../crm-env.js';
import { CrmFetch } from '../crm-fetch.js';
import { LogFunction } from '../types.js';

/**
 * Efficy SDK build around crm webrequests such as /query, /global-search, /save
 */
export class CrmApi extends CrmFetch {
	constructor(crmEnv?: CrmEnv, logFunction?: LogFunction, threadId?: number) {
		super(crmEnv, logFunction, threadId);
	}

	async searchGlobal() {
		
	}
}