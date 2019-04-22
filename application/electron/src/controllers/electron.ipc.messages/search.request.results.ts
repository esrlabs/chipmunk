export interface ISearchRequestResults {
    streamId: string;
    requestId: string;
    results: { [regIndex: number]: number[] };
    matches: number[];
    error?: string;
    found: number;
    duration: number;
}

export class SearchRequestResults {
    public static signature: string = 'SearchRequestResults';
    public signature: string = SearchRequestResults.signature;
    public streamId: string;
    public requestId: string;
    public results: { [regIndex: number]: number[] };
    public matches: number[];
    public found: number;
    public duration: number;
    public error?: string;

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
        if (typeof params.results !== 'object' || params.results === null) {
            throw new Error(`Field "results" should be { [regIndex: number]: number[] }`);
        }
        if (!(params.matches instanceof Array)) {
            throw new Error(`Field "matches" should be number[]`);
        }
        if (params.error !== undefined && typeof params.error !== 'string') {
            throw new Error(`Field "requestId" should be defined`);
        }
        if (typeof params.found !== 'number' || isNaN(params.found) || !isFinite(params.found)) {
            throw new Error(`Field "found" should be defined`);
        }
        if (typeof params.duration !== 'number' || isNaN(params.duration) || !isFinite(params.duration)) {
            throw new Error(`Field "duration" should be defined`);
        }
        this.streamId = params.streamId;
        this.requestId = params.requestId;
        this.results = params.results;
        this.matches = params.matches;
        this.error = params.error;
        this.found = params.found;
        this.duration = params.duration;
    }
}
