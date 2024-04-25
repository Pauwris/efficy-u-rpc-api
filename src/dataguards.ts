import { JsonApiErrorNode, JsonApiResponse, RpcNamedOperation } from "./types";

export function isJSONRPCNamedOperation(obj: any): obj is RpcNamedOperation {
	return typeof obj['#id'] === 'string' && typeof obj['@name'] === 'string' && Array.isArray(obj['@func']);
}

export function isJsonApiResponse(response: any): response is JsonApiResponse {
    return (
        typeof response === 'object' &&	response !== null && 
        typeof response.data === 'object' &&
        Array.isArray(response.errors) &&
        Array.isArray(response.status)
    );
}

export function isJsonApiErrorNode(err: any): err is JsonApiErrorNode {
    return (
        typeof err === 'object' && err !== null &&
        'detail' in err && typeof err.detail === 'string' &&
        'extra' in err && typeof err.extra === 'object' &&
        'id' in err && typeof err.id === 'string' &&
        'title' in err && typeof err.title === 'string'
    );
}