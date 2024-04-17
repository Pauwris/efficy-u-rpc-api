export type Nil = null | undefined;
export type JSONExtantPrimitive = number | string | boolean;
export type JSONPrimitive = JSONExtantPrimitive | Nil;
export type JSONPrimitiveObject = Record<string, JSONPrimitive>