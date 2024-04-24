export type UnityKey = "" | string;
export type Nil = null | undefined;
export type JSONPrimitive = number | string | boolean | Nil;
export type JSONPrimitiveObject = Record<string, JSONPrimitive>
export type ErrorFunction = (message: string) => void;
export type LogFunction = (message: string, object: object) => void;

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

export * from "./rpc/types"
export * from "./api/types/search"
