export interface ISearchIndexAroundResponse {
    after: number;
    before: number;
}

export class SearchIndexAroundResponse {

    public static signature: string = 'SearchIndexAroundResponse';
    public signature: string = SearchIndexAroundResponse.signature;
    public after: number;
    public before: number;

    constructor(params: ISearchIndexAroundResponse) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for SearchIndexAroundResponse message`);
        }
        if (typeof params.after !== 'number' || isNaN(params.after) || !isFinite(params.after)) {
            throw new Error(`after should be not empty string.`);
        }
        if (typeof params.before !== 'number' || isNaN(params.before) || !isFinite(params.before)) {
            throw new Error(`before should be not empty string.`);
        }
        this.after = params.after;
        this.before = params.before;
    }
}
