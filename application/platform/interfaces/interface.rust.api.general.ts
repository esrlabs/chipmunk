import { IFilter } from '../types/filter';

export { IFilter, IFilterFlags } from '../types/filter';
export { IGrabbedContent, IGrabbedElement } from '../types/content';

export interface IMatchEntity {
    filter: string;
    match: string;
    row: number;
}

export interface IMapEntity {
    filter: string;
    rows: number[];
}

export interface IExtractedValueSrc {
    index: number; // row position in the stream
    // [filter_index, [values]]
    values: Array<Array<number | string[]>>;
}
export type TExtractedValuesSrc = IExtractedValueSrc[];

export interface IExtractedMatch {
    filter: IFilter;
    values: string[];
}

export interface IExtractedValue {
    position: number; // row position in the stream
    values: IExtractedMatch[];
}

export type TExtractedValues = IExtractedValue[];

/**
 * TODO: it should be removed!
 * Output for @search method of session
 * (application/apps/rustcore/ts/src/native/native.session.ts)
 */
export interface IResultSearchElement {
    position: number; // Original position in stream
    filters: number[]; // Indexes of matched filters, fit to indexes, which was
    // provided with search(filters: IFilter[])
    // (application/apps/rustcore/ts/src/native/native.session.ts)
    content: string; // Row value
}

export type ISearchMap = Array<[number, number][]>;

export type IValuesMap = { [key: number]: [number, number, number, number][] };
export type IValuesMinMaxMap = { [key: number]: [number, number] };

/**
 * Output for @extract method of session
 * (application/apps/rustcore/ts/src/native/native.session.ts)
 */
export interface IExtractDTFormatResult {
    format: string;
    reg: string;
    timestamp: string;
}

/**
 * Input for @extract method of session
 * (application/apps/rustcore/ts/src/native/native.session.ts)
 */
export interface IExtractDTFormatOptions {
    input: string;
    format?: string;
}

/**
 * Input for @concat method of session
 * (application/apps/rustcore/ts-bindings/src/api/session.stream.concat.executor.ts)
 */
export interface IConcatFile {
    path: string;
    tag: string;
}

export interface IFileMergeOptions {
    /// Path to the file to merge
    path: string;
    /// Offset in ms, this will be added to each posix timestamp
    offset?: number;
    /// If a year is provided and if no year was detected, this is what we use
    year?: number;
    /// An identifier string for the file
    tag: string;
    /// how we interpret the date string in each line
    format: string;
}

export interface INearest {
    index: number;
    position: number;
}
