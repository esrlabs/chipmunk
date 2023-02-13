export interface IFilterFlags {
    reg: boolean;
    word: boolean;
    cases: boolean;
}

export interface IFilter {
    filter: string;
    flags: IFilterFlags;
}

export interface ISearchStats {
    stats: { [key: string]: number };
}

export interface ISearchUpdated {
    found: number;
    stat: { [key: string]: number };
}

export type SearchValuesResult = Map<number, Map<number, string>>;

export type SearchValuesResultOrigin = { [key: string | number]: [number, string][] };
