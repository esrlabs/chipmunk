export interface IRow {
    position: number;
    timestamp: number;
    str: string;
}

export interface IRange {
    points: IRow[];
}
