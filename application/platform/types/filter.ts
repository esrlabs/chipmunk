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
    stats: { [key: number]: number };
}

export interface ISearchUpdated {
    found: number;
    stat: { [key: number]: number };
}
