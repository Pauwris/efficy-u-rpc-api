export type CustomDatasetPayloads = ListSummaryPayload;

export interface ListSummaryPayload {
    fields: string[];
    groupBy?: string[];
    nbOfLines?: number;
    // USAGE: [["val = 1", "val2 = 2]] => val = 1 AND val2 = 2 // [["val = 1"], ["val2 = 2]] => val = 1 OR val2 = 2
    orderBy?: string[];
    query?: string[][];
    startIndex?: number;
    tableName: string;
}

export type ListSummaryResponse<T = unknown> = ListSummaryServerResponse<T>

export interface ListSummaryServerResponse<T = unknown> {
    errors?: ListSummaryError[];
    list: T[];
}

export interface ListSummaryError {
    detail: string;
    extra: string;
    id: string;
    title: string;
}