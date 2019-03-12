export interface ISearchRequestResults {
    streamId: string;
    requestId: string;
    results: { [regIndex: number]: number[] };
}

export class SearchRequestResults {
    public static signature: string = 'SearchRequestResults';
    public signature: string = SearchRequestResults.signature;
    public streamId: string;
    public requestId: string;
    public results: { [regIndex: number]: number[] };

    constructor(params: ISearchRequestResults) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for SearchRequestResults message`);
        }
        if (typeof params.streamId !== 'string' || params.streamId.trim() === '') {
            throw new Error(`Field "streamId" should be defined`);
        }
        if (typeof params.requestId !== 'string' || params.requestId.trim() === '') {
            throw new Error(`Field "requestId" should be defined`);
        }
        if (!(params.results instanceof Array)) {
            throw new Error(`Field "results" should be an instance of RegExp`);
        }
        this.streamId = params.streamId;
        this.requestId = params.requestId;
        this.results = params.results;
    }
}
