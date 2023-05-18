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

export enum EFlag {
    cases = 'cases',
    word = 'word',
    reg = 'reg',
}
