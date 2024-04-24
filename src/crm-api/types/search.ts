import { JSONPrimitive, UnityKey } from "../../types";

export interface EntitySearch {
    name: string;
    offset: number;
    rows: SearchItem[];
    total: number;
    uniqueKey: string;
}

export type RefinedOptions = {
    autoFilterByType?: boolean;
    createdDateEnd?: string;
    createdDateStart?: string;
    exactFieldValue?: boolean;
    includeArchived?: boolean;
    links?: LinkSearch[];
    notLinkedTo?: UnityKey;
    onlyItemsLinkedTo?: UnityKey;
    onlyItemsLinkedToMe?: boolean;
    onlyItemsLinkedToMeAndMyGroups?: boolean;
    onlyMyItems?: boolean;
    requiredFields?: RequiredFieldSearch[];
    updatedDateEnd?: string;
    updatedDateStart?: string;
}

export type SearchRequest = {
    entities: string[];
    //filtering by entity name
    offset: number;
    quantity: number;
    refinedOptions: RefinedOptions;
    value: string;
}

export type RequiredFieldSearch = {
    field: string;
    values?: string[];
}

export type LinkSearch = {
    key?: UnityKey[];
    main?: boolean;
    tables?: number[];
}

export interface BasicSearchItem {
    key: string;
    name: string;
    picturePath?: string;
    secondaryText?: string;
    type: string;
}

export type SearchItemField<T extends JSONPrimitive = JSONPrimitive> = {
    name: string;
    value: T | undefined;
}

export interface SearchItemLink {
    displayText: string;
    objectKey: UnityKey;
}

export interface SearchItem<T extends JSONPrimitive = JSONPrimitive> extends BasicSearchItem {
    fields: SearchItemField<T>[];
    links?: Record<string, SearchItemLink>;
    page?: RouterLink;
    tag: string;
}

export type RouterLink = {
    name: string;
    params?: {
        [key: string]: string;
    };
}
export type TransformItemFunc = (item: SearchItem) => Promise<SearchItem>;

export interface SearchPayload {
    identifier: string;
}
export interface SearchInServerPayload extends SearchPayload {
    search: SearchRequest;
}
export interface GetSearchResultPayload extends SearchInServerPayload {
    searchMine?: boolean;
    transformItem?: TransformItemFunc;
}

export type SearchEntityResponse = {
    entity: string;
    rows: SearchItem[];
    total: number;
}