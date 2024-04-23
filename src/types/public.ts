export type UKey = "" | string;
export type Nil = null | undefined;
export type JSONPrimitive = number | string | boolean | Nil;
export type JSONPrimitiveObject = Record<string, JSONPrimitive>
export type ErrorFunction = (message: string) => void;
export type LogFunction = (message: string, object: object) => void;