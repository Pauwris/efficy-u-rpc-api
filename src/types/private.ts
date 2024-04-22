export interface IRpcNamedOperation {
    "@name": string;
    "#id"?: string;
    "@func": object[];
    [key: string]: any;
}