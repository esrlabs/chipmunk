export interface ISearchRequestFinished {
    streamId: string;
    requestId: string;
    duration: number;
    error?: string;
}

export class SearchRequestFinished {
    public static signature: string = 'SearchRequestFinished';
    public signature: string = SearchRequestFinished.signature;
    public streamId: string;
    public requestId: string;
    public duration: number;
    public error?: string;

    constructor(params: ISearchRequestFinished) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for SearchRequestFinished message`);
        }
        if (typeof params.streamId !== 'string' || params.streamId.trim() === '') {
            throw new Error(`Field "streamId" should be defined`);
        }
        if (typeof params.requestId !== 'string' || params.requestId.trim() === '') {
            throw new Error(`Field "requestId" should be defined`);
        }
        this.streamId = params.streamId;
        this.requestId = params.requestId;
        this.duration = params.duration;
        this.error = params.error;
    }
}
