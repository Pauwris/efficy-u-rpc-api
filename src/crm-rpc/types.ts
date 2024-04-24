export interface RpcNamedOperation {
    "@name": string;
    "#id"?: string;
    "@func": object[];
    [key: string]: any;
}