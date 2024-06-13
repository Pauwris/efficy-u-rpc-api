import { UnityKey } from "@/types";

export interface SystemClearCachesDataResponse {
    message: string
}
export interface SystemCachesDataResponse {
    references: Record<UnityKey, SystemCachesReference>
    refDefinitions: Record<string, SystemCachesRefDefinition>
    mapOfRefCodeByKey: Record<string, UnityKey>
}

export interface SystemCachesReference {
    refKey: UnityKey
    refCode: string
    te1: string
    te2: string
    te3: string
    pos: number
    tabName: string
    tabPrefix: string
}
export interface SystemCachesRefDefinition {
    refdKey: UnityKey
    name: string
    prefix: string
    text1: string
    text2: string
    text3: string
    radical: string
    id: UnityKey
}