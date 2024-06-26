import { isJsonApiResponse } from '../dataguards.js';
import { CrmEnv } from '../crm-env.js';
import { CrmFetch } from '../crm-fetch.js';
import { SystemClearCachesDataResponse, CustomDatasetPayloads, GetSearchResultPayload, JsonApiResponse, ListSummaryPayload, ListSummaryResponse, ModulePostPayload, QueryStringArgs, SystemCachesDataResponse } from '../types.js';

import searchGlobalService from "./service/search.js";
import { CrmRpc } from '@/crm-rpc/index.js';

/**
 * Efficy SDK build around crm JSON web requests with endpoints such as "crm/query", "crm/global-search" and "crm/save".
 * Each method immediatly invokes a request to the server and returns the received data object.
 */
export class CrmApi extends CrmFetch {
	constructor(crmEnv?: CrmEnv) {
		super(crmEnv);
        this.name = "CrmApi";
	}

    /**
     * Some operations cannot create their own session (e.g. systemClearCaches), hence this explicit logon
     */
    async logon() {
        const crmRpc = new CrmRpc(this.crmEnv);
        crmRpc.currentDatabaseAlias;
        await crmRpc.executeBatch();
    }

    /**
     * Global elastic search in Efficy, with various filtering options
     * @example
     * const payload: GetSearchResultPayload = {
     *   identifier: "",
     *   search: {
     *     entities: ["cont"],
     *     value: searchedContact.toLocaleLowerCase(),
     *     offset: 0,
     *     quantity: 5,
     *     refinedOptions: {
     *       onlyItemsLinkedToMe: false
     *     }
     *   }
     * }
     * const searchResult: EntitySearch[] = await crm.searchGlobal(payload);
     */
    searchGlobal = (payload: GetSearchResultPayload) => searchGlobalService(this, payload);

    /**
     * Generate a list summary query
     * @example
     * const currencyPayload: ListSummaryPayload = {
     *   fields: ["crcyName", "crcyCode", "crcySymbol", "crcyCode", "crcyKey"],
     *   tableName: "Currency",
     *   query: [["crcyIsDisabled = 0"]]
     * };
     * const result = await crm.listSummary<Crcy>(currencyPayload);
     * const euro = result?.list.find(item => item.crcyCode === "EUR")
     *
     * const companyPayload: ListSummaryPayload = {
     *   fields: ["compKey", "compName"],
     *   tableName: "Company",
     *   query: [["compArchived = 1", "compName like 'Efficy%'"]]
     * };
     */
    async listSummary<T = unknown>(payload: CustomDatasetPayloads, all: boolean = true): Promise<ListSummaryResponse<T> | undefined> {
        const urlQueryStrings = {
            queryType: "LISTSUMMARY",
            all,
        };

        const listSumPayload = payload as ListSummaryPayload;

        if (listSumPayload.nbOfLines && listSumPayload.nbOfLines === 0) {
            delete listSumPayload.nbOfLines;
        }

        return await this.crmPostData<ListSummaryResponse<T>>("query", payload, urlQueryStrings);
    }

    /**
     * Refresh the Crm server cache. Useful after modifying security or reference values. Requires an active session.
     * @example
     * const crmApi = new CrmApi(crmEnv);
     * await crmApi.logon(); // Makes sure there is an active session
     * const result = await crmApi.clearServerCaches();
     */
    async systemClearCaches(): Promise<SystemClearCachesDataResponse> {
        return await this.crmGetData<SystemClearCachesDataResponse>("system/clearCaches");
    }
    /**
     * Get an optionally refresh the Crm reference cache. Requires an active session.
     * @example
     * const crmApi = new CrmApi(crmEnv);
     * await crmApi.logon(); // Makes sure there is an active session
     * const references = await crmApi.systemReference(false);
     */
    async systemReference(noCache: boolean): Promise<SystemCachesDataResponse> {
        return await this.crmGetData<SystemCachesDataResponse>("system/reference?nocache=", {
            nocache: noCache ? "true" : undefined
        });
    }

    crmGetData = async <R>(crmPath: string, payload?: QueryStringArgs): Promise<R> =>
        (await this.crmGet<JsonApiResponse<R>>(crmPath, payload)).data;

    crmPostData = async <R>(crmPath: string, payload: ModulePostPayload, queryStringArgs: QueryStringArgs): Promise<R> =>
        (await this.crmPost<JsonApiResponse<R>>(crmPath, payload, queryStringArgs)).data;

    private async crmGet<R>(crmPath: string, queryStringArgs: QueryStringArgs = {}): Promise<R> {
        this.initJsonFetch("GET");
		const requestUrl = this.getRequestUrl(crmPath, queryStringArgs)
		const response: object = await this.crmfetch(requestUrl);
        if (isJsonApiResponse(response)) {
            return response as R;
        } else {
            throw new Error(`${this.name}.crmGet::unexpected response`);
        }
	}

    private async crmPost<R>(crmPath: string, payload: object, queryStringArgs?: QueryStringArgs): Promise<R> {
        this.initJsonFetch("POST");
        const requestUrl = this.getRequestUrl(crmPath, queryStringArgs)
        const requestOptions: RequestInit = {
            body: JSON.stringify(payload)
        }
		const response: object = await this.crmfetch(requestUrl, payload, requestOptions);

        if (isJsonApiResponse(response)) {
            return response as R;
        } else {
            throw new Error(`${this.name}.crmPost::unexpected response`);
        }
	}
}