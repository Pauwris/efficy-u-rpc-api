export type UKey = "" | string & { length: 16 };

export type Nil = null | undefined;
export type JSONExtantPrimitive = number | string | boolean;
export type JSONPrimitive = JSONExtantPrimitive | Nil;
export type JSONPrimitiveObject = Record<string, JSONPrimitive>

export interface JSONRPCNamedOperation {
    "@name": string;
    "#id"?: string;
    "@func": object[];
    [key: string]: any;
}

export interface JSONRPCNameObject {
    "@name": string;
    "@func": object[];
	[key: string]: any;
}

export function isJSONRPCNamedOperation(obj: any): obj is JSONRPCNamedOperation {
    return typeof obj['#id'] === 'string' && typeof obj['@name'] === 'string' && Array.isArray(obj['@func']);
}

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
