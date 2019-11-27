export interface ISearchStreamUpdated {
    guid: string;
    length: number;
    rowsCount: number;
    addedRowsData: string;
    addedFrom: number;
    addedTo: number;
}

export class SearchStreamUpdated {
    public static signature: string = 'SearchStreamUpdated';
    public signature: string = SearchStreamUpdated.signature;
    public guid: string;
    public length: number;
    public rowsCount: number;
    public addedRowsData: string;
    public addedFrom: number;
    public addedTo: number;

    constructor(params: ISearchStreamUpdated) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for SearchStreamUpdated message`);
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
        if (typeof params.addedFrom !== 'number' || isNaN(params.addedFrom) || !isFinite(params.addedFrom)) {
            throw new Error(`Field "addedFrom" should be defined as number (not NaN and finited)`);
        }
        if (typeof params.addedTo !== 'number' || isNaN(params.addedTo) || !isFinite(params.addedTo)) {
            throw new Error(`Field "addedTo" should be defined as number (not NaN and finited)`);
        }
        if (typeof params.addedRowsData !== 'string') {
            throw new Error(`Field "addedRowsData" should be defined`);
        }
        this.guid = params.guid;
        this.length = params.length;
        this.rowsCount = params.rowsCount;
        this.addedRowsData = params.addedRowsData;
        this.addedFrom = params.addedFrom;
        this.addedTo = params.addedTo;
    }
}
