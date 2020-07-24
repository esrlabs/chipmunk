export interface IRow {
    position: number;
    timestamp: number;
    str: string;
}

export interface IRange {
    start: IRow;
    end: IRow;
}
