import { CrmEnv } from '../crm-env.js';
import { CrmFetch } from '../crm-fetch.js';
import { EntitySearch, GetSearchResultPayload, JsonApiResponse, LogFunction, QueryStringArgs, SearchEntityResponse, SearchRequest, TransformItemFunc } from '../types.js';

/**
 * Efficy SDK build around crm JSON web requests with endpoints such as "crm/query", "crm/global-search" and "crm/save".
 * Each method immediatly invokes a request to the server and returns the received data object.
 */
export class CrmApi extends CrmFetch {
	constructor(crmEnv?: CrmEnv, logFunction?: LogFunction, threadId?: number) {
		super(crmEnv, logFunction, threadId);
        this.name = "CrmApi";
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
            
			const queryStringArgs = transformSearchRequestIntoPayload(payload.search);
            const response = await this.crmGetData<JsonApiResponse<Record<string, SearchEntityResponse>>>(this.#urls.query, queryStringArgs);

            for (const entity in response.data) {
                const entityValues = response.data[entity];
                if (!entityValues) continue;
                result.push(await parseEntitySearchResult(entityValues, payload.transformItem));
            }
        }

        return result;
	}

    protected crmGetData = async <R>(url: string, payload?: QueryStringArgs): Promise<R> =>
        (await this.crmGetRequest<JsonApiResponse<R>>(url, payload)).data;

    private async crmGetRequest<R>(crmPath: string, payload: QueryStringArgs = {}): Promise<R> {
        const params = new URLSearchParams();
        for (const [key, value] of Object.entries(payload)) {
            params.append(key, value.toString());
        }

        // Useful for development environments
        if (this.crmEnv.customer) {
            params.append("customer", this.crmEnv.customer);
        }

        const queryString = params.toString();
		const requestUrl = `${this.crmEnv.url}/crm/${crmPath}?${queryString}`;
		const response: object = await this.fetch(requestUrl);
        if (this.isJsonApiResponse(response)) {
            return response as R;
        } else {
            throw new Error(`${this.name}.crmGet::unexpected response`);
        }
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