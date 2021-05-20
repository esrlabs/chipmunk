export interface ISearchRequestResults {
    streamId: string;
    requestId: string;
    stats: number[][];
    error?: string;
    found: number;
    duration: number;
}

export class SearchRequestResults {
    public static signature: string = 'SearchRequestResults';
    public signature: string = SearchRequestResults.signature;
    public streamId: string;
    public requestId: string;
    public stats: number[][];
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
        if (!(params.stats instanceof Array)) {
            throw new Error(`Field "stats" should be defined`);
        }
        if (params.error !== undefined && typeof params.error !== 'string') {
            throw new Error(`Field "error" should be defined`);
        }
        if (typeof params.found !== 'number' || isNaN(params.found) || !isFinite(params.found)) {
            throw new Error(`Field "found" should be defined`);
        }
        if (typeof params.duration !== 'number' || isNaN(params.duration) || !isFinite(params.duration)) {
            throw new Error(`Field "duration" should be defined`);
        }
        this.streamId = params.streamId;
        this.requestId = params.requestId;
        this.stats = params.stats;
        this.error = params.error;
        this.found = params.found;
        this.duration = params.duration;
    }
}
