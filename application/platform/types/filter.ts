export interface IFilterFlags {
    reg: boolean;
    word: boolean;
    cases: boolean;
}

export interface IFilter {
    filter: string;
    flags: IFilterFlags;
}

export interface ISearchResults {
    found: number;
    stats: Array<Array<number>>; // This is Array<Array<number>>
    // Each index in root array - position in search stream
    // Each sub index - index of filter, which has a match
}
