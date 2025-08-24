import { CrmEnv } from '../crm-env.js';
import { CrmFetch } from '../crm-fetch.js';
import { QueryStringArgs } from '@/types.js';
import {type v1 } from './types/index.js';

/**
 * A limited and simplified version of an Efficy SDK build around the public API version 1.
 * Each method immediatly invokes a request to the server and returns the received data object.
 * @link https://help.efficy.cloud/api/#description/introduction
 */
export class Api extends CrmFetch {
  constructor(crmEnv?: CrmEnv, private apiVersion: string = "v1") {
        const subpage = `api/${apiVersion}/`;
        const isPublicAPI = true;
        if (crmEnv) {
            if (crmEnv.pwd) {
                throw new Error('User credentials are not allowed in public API requests');
            }
            if (!crmEnv.apiKey) {
                throw new Error('API key is required for public API requests');
            }
            crmEnv.retryWithNewSession = false;
            crmEnv.useCookies = false;
            crmEnv.logOff = false;
        }
    super(crmEnv, subpage, isPublicAPI);
        this.name = "PublicApi";
  }

    /**
     * Retrieve a list of files linked to a specific document
     * @param docuKey - ID of the document
     * @returns
     */
    getDocumentFiles = async <T = v1.DocumentFiles>(docuKey: string, queryParams?: QueryParams) => {
        const apiPath = `documents/${docuKey}/files`;
        return await this.apiGetData<T>(apiPath, queryParams);
    }

    /**
     * Retrieve file linked to a specific document
     * @param docuKey - ID of the documents
     * @param fileKey - ID of the file
     * @returns
     */
    getDocumentFile = async <T = v1.DocumentFile>(docuKey: string, fileKey: string) => {
        const apiPath = `documents/${docuKey}/files/${fileKey}`;
        return await this.apiGetData<T>(apiPath);
    }

    apiGetData = async <R>(apiPath: string, payload?: QueryStringArgs): Promise<R | null> =>
        (await this.apiGet<R>(apiPath, payload));

    private async apiGet<R>(apiPath: string, queryStringArgs: QueryStringArgs = {}): Promise<R | null> {
        this.initJsonFetch("GET");
    const requestUrl = this.getRequestUrl(apiPath, queryStringArgs)
    return await this.crmfetch(requestUrl) as R | null;
  }
}

export class QueryParams {
    constructor(public order_by?: string, public offset?: number, public limit?: number) {}
}