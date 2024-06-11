export type UnityKey = "" | string;
export type Nil = null | undefined;
export type JSONPrimitive = number | string | boolean | Nil;
export type JSONPrimitiveRecord = Record<string, JSONPrimitive>

export type ErrorData = Record<"title" | "id" | "detail", string | ErrorDetail>;
export type ErrorDetail = Record<"id" | "message" | "objectKey", string>;
export type QueryStringArgs = Record<string, string | undefined> | object | URLSearchParams
export type ModulePostPayload = FormData | object | unknown[] | URLSearchParams

export interface JsonApiResponse<Data = unknown> {
    data: Data;
    errors: JsonApiErrorNode[];
    status: number[];
}
export interface JsonApiErrorNode {
    detail: string;
    extra: any;
    id: string;
    title: string;
}

export interface CrmEnvConfig {
	url?: string;
	customer?: string;
	apiKey?: string;
	user?: string;
	pwd?: string;
	cookies?: Cookie[];

	logOff?: boolean;
	useFetchQueue?: boolean;
	retryWithNewSession?: boolean;
}

export interface Cookie {
	name: string;
	value: string;
	path?: string;
	expires?: string;
}

export interface CrmFetchRequestInterceptorFunction {
	(request: Request): Promise<void>
}
export interface CrmFetchResponseInterceptorFunction {
	(response: Response): Promise<void>
}
export interface CrmFetchErroreInterceptorFunction {
	(e: Error, request: Request, requestPayload: ModulePostPayload | undefined, response: Response | null): Promise<void>
}

export * from "./crm-api/types"
export * from "./crm-rpc/types"
