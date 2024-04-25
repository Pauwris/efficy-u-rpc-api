export type UnityKey = "" | string;
export type Nil = null | undefined;
export type JSONPrimitive = number | string | boolean | Nil;
export type JSONPrimitiveRecord = Record<string, JSONPrimitive>
export type ErrorFunction = (message: string) => void;
export type LogFunction = (message: string, object: object) => void;

export type ErrorData = Record<"title" | "id" | "detail", string | ErrorDetail>;
export type ErrorDetail = Record<"id" | "message" | "objectKey", string>;

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

export type QueryStringArgs = Record<string, string | undefined> | object | URLSearchParams

export interface CrmEnvConfig {
	url?: string;
	customer?: string;
	logOff?: boolean;
	useFetchQueue?: boolean;
	apiKey?: string;
	user?: string;
	pwd?: string;
	cookies?: Cookie[];
}

export interface Cookie {
	name: string;
	value: string;
	expires?: string;
}

export * from "./crm-api/types"
export * from "./crm-rpc/types"

