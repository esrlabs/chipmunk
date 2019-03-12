export interface ISearchRequestStarted {
    streamId: string;
    requestId: string;
}

export class SearchRequestStarted {
    public static signature: string = 'SearchRequestStarted';
    public signature: string = SearchRequestStarted.signature;
    public streamId: string;
    public requestId: string;

    constructor(params: ISearchRequestStarted) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for SearchRequestStarted message`);
        }
        if (typeof params.streamId !== 'string' || params.streamId.trim() === '') {
            throw new Error(`Field "streamId" should be defined`);
        }
        if (typeof params.requestId !== 'string' || params.requestId.trim() === '') {
            throw new Error(`Field "requestId" should be defined`);
        }
        this.streamId = params.streamId;
        this.requestId = params.requestId;
    }
}
