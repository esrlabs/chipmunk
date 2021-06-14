export interface ISearchUpdated {
    guid: string;       // guid of session
    matches: number;    // count of rows in search results
    rows: number;       // count of rows in content (session output)
}

export class SearchUpdated {
    public static signature: string = 'SearchUpdated';
    public signature: string = SearchUpdated.signature;
    public guid: string;
    public matches: number;
    public rows: number;

    constructor(params: ISearchUpdated) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for SearchUpdated message`);
        }
        if (typeof params.guid !== 'string' || params.guid.trim() === '') {
            throw new Error(`Field "guid" should be defined`);
        }
        if (typeof params.matches !== 'number' || isNaN(params.matches) || !isFinite(params.matches)) {
            throw new Error(`Field "matches" should be defined as number (not NaN and finited)`);
        }
        if (typeof params.rows !== 'number' || isNaN(params.rows) || !isFinite(params.rows)) {
            throw new Error(`Field "rows" should be defined as number (not NaN and finited)`);
        }
        this.guid = params.guid;
        this.matches = params.matches;
        this.rows = params.rows;
    }
}
