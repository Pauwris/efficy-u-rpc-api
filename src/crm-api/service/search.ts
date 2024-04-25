import { CrmApi } from '../index.js';
import { EntitySearch, GetSearchResultPayload, QueryStringArgs, SearchEntityResponse, SearchRequest, TransformItemFunc } from '../../types.js';

export default async (crmApi: CrmApi, payload: GetSearchResultPayload): Promise<EntitySearch[]> => {
    const result: EntitySearch[] = [];
    
    if (payload.search.entities.length > 0) {
        if (payload.searchMine) {
            payload.search.refinedOptions.onlyMyItems = true;
        }
        
        const queryStringArgs = transformSearchRequestIntoPayload(payload.search);
        const records = await crmApi.crmGetData<Record<string, SearchEntityResponse>>("search-global/query", queryStringArgs);

        for (const entity in records) {
            const entityValues = records[entity];
            if (!entityValues) continue;
            result.push(await parseEntitySearchResult(entityValues, payload.transformItem));
        }
    }

    return result;
}

const transformSearchRequestIntoPayload = (search: SearchRequest): QueryStringArgs => ({
    entities: JSON.stringify(search.entities.filter((entity) => entity)),
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
    uniqueKey: "",
});