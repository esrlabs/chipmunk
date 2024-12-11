export interface FilterMatch {
    index: number;
    filters: number[];
}
export interface Range {
    start: number;
    end: number;
}
export interface SdeRequest {
    WriteText?: string;
    WriteBytes?: number[];
}
export interface SdeResponse {
    bytes: number;
}
export interface GrabbedElement {
    source_id: number;
    content: string;
    pos: number;
    nature: number;
}
export type FilterMatchList = FilterMatch[];
export interface SourceDefinition {
    id: number;
    alias: string;
}
export type GrabbedElementList = GrabbedElement[];
export type AroundIndexes = [number | null, number | null];
export type Sources = SourceDefinition[];
export type Ranges = Range[];
