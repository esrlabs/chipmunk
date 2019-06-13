export interface ISearchUpdated {
    guid: string;
    length: number;
    rowsCount: number;
}

export class SearchUpdated {
    public static signature: string = 'SearchUpdated';
    public signature: string = SearchUpdated.signature;
    public guid: string;
    public length: number;
    public rowsCount: number;

    constructor(params: ISearchUpdated) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for SearchUpdated message`);
        }
        if (typeof params.guid !== 'string' || params.guid.trim() === '') {
            throw new Error(`Field "guid" should be defined`);
        }
        if (typeof params.length !== 'number' || isNaN(params.length) || !isFinite(params.length)) {
            throw new Error(`Field "length" should be defined as number (not NaN and finited)`);
        }
        if (typeof params.rowsCount !== 'number' || isNaN(params.rowsCount) || !isFinite(params.rowsCount)) {
            throw new Error(`Field "rowsCount" should be defined as number (not NaN and finited)`);
        }
        this.guid = params.guid;
        this.length = params.length;
        this.rowsCount = params.rowsCount;
    }
}
