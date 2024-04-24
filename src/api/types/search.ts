import { UnityKey } from "../../types";

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
