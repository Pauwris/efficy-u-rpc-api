import { CrmEnv } from '../crm-env.js';
import { CrmFetch } from '../crm-fetch.js';
import { EntitySearch, GetSearchResultPayload, JsonApiResponse, LogFunction, QueryStringArgs, SearchEntityResponse, SearchRequest, TransformItemFunc } from '../types.js';

/**
 * Efficy SDK build around crm webrequests such as /query, /global-search, /save
 */
export class CrmApi extends CrmFetch {
	constructor(crmEnv?: CrmEnv, logFunction?: LogFunction, threadId?: number) {
		super(crmEnv, logFunction, threadId);
	}

	readonly #urls = {
        query: "search-global/query"
    };
    
	async searchGlobal(payload: GetSearchResultPayload): Promise<EntitySearch[]> {
		const result: EntitySearch[] = [];
        if (payload.search.entities.length > 0) {
            if (payload.searchMine) {
                payload.search.refinedOptions.onlyMyItems = true;
            }

            //const response = await this.crmGet<JsonApiResponse<Record<string, SearchEntityResponse>>>(this.#urls.query, transformSearchRequestIntoPayload(payload.search));
			const fetchPayload = transformSearchRequestIntoPayload(payload.search);
			const response = await this.fetch(this.#urls.query, {}) as JsonApiResponse<Record<string, SearchEntityResponse>>;

            for (const entity in response.data) {
                const entityValues = response.data[entity];
                if (!entityValues) continue;
                result.push(await parseEntitySearchResult(entityValues, payload.transformItem));
            }
        }

        return result;
	}
}

const transformSearchRequestIntoPayload = (search: SearchRequest): QueryStringArgs => ({
    entities: JSON.stringify(search.entities.filter((entity) => entity)), // filtering falsy values (like undefined, if not the backend report an error).
    offset: search.offset.toString(),
    quantity: search.quantity.toString(),
    query: search.value,
    refinedOptions: JSON.stringify(search.refinedOptions),
});

const parseEntitySearchResult = async (element: SearchEntityResponse, transformFunc?: TransformItemFunc): Promise<EntitySearch> => ({
    name: element.entity,
    offset: element.rows.length,
    rows: transformFunc ? await Promise.all(element.rows.map((item) => transformFunc(item))) : element.rows,
    total: element.total,
    uniqueKey: "object-search",
});