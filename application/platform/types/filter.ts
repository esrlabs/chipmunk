export interface IFilterFlags {
    reg: boolean;
    word: boolean;
    cases: boolean;
}

export interface IFilter {
    filter: string;
    flags: IFilterFlags;
}

export interface FilterDefinition {
    filter: IFilter;
    colors: FilterStyle;
    active: boolean;
    uuid: string;
}

export interface FilterStyle {
    color: string;
    background: string;
}

export interface ISearchStats {
    stats: { [key: string]: number };
}

export interface ISearchUpdated {
    found: number;
    stat: { [key: string]: number };
}

export enum EFlag {
    cases = 'cases',
    word = 'word',
    reg = 'reg',
}

export type ISearchMap = Array<[number, number][]>;

export type IValuesMap = { [key: number]: [number, number, number, number][] };

export type IValuesMinMaxMap = { [key: number]: [number, number] };

export interface INearest {
    index: number;
    position: number;
}

export interface IExtractedMatch {
    filter: IFilter;
    values: string[];
}

export interface IExtractedValueSrc {
    index: number; // row position in the stream
    // [filter_index, [values]]
    values: Array<Array<number | string[]>>;
}
export type TExtractedValuesSrc = IExtractedValueSrc[];

export interface IExtractedValue {
    position: number; // row position in the stream
    values: IExtractedMatch[];
}

export type TExtractedValues = IExtractedValue[];

export interface IMatchEntity {
    filter: string;
    match: string;
    row: number;
}

export interface IMapEntity {
    filter: string;
    rows: number[];
}
