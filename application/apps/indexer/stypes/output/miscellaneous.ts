export interface SourceDefinition {
    id: number;
    alias: string;
}
export type FilterMatchList = FilterMatch[];
export type Sources = SourceDefinition[];
export type AroundIndexes = [number | null, number | null];
export type GrabbedElementList = GrabbedElement[];
export interface FilterMatch {
    index: number;
    filters: number[];
}
export type SdeRequest =
    { WriteText: string } |
    { WriteBytes: number[] };
export interface Range {
    start: number;
    end: number;
}
export interface GrabbedElement {
    source_id: number;
    content: string;
    pos: number;
    nature: number;
}
export type Ranges = Range[];
export interface SdeResponse {
    bytes: number;
}
