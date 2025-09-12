import { CrmApi } from '../index.js';
import { EntitySearch, GetSearchResultPayload, QueryStringArgs, SearchRequest } from '../../types.js';

export default async (crmApi: CrmApi, payload: GetSearchResultPayload): Promise<Record<string, EntitySearch> | null> => {

    if (payload.search.entities.length > 0) {
        if (payload.searchMine) {
            payload.search.refinedOptions.onlyMyItems = true;
        }

        const queryStringArgs = transformAsQueryStringArgs(payload.search);
        return await crmApi.crmGetData<Record<string, EntitySearch>>("search-global/query", queryStringArgs);
    }

    return null;
}

const transformAsQueryStringArgs = (search: SearchRequest): QueryStringArgs => ({
    entities: JSON.stringify(search.entities.filter((entity) => entity)),
    offset: search.offset.toString(),
    quantity: search.quantity.toString(),
    query: search.value,
    refinedOptions: JSON.stringify(search.refinedOptions),
});