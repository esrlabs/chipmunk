export interface ISearchRequestCancelRequest {
    streamId: string;
    requestId: string;
}

export class SearchRequestCancelRequest {
    public static signature: string = 'SearchRequestCancelRequest';
    public signature: string = SearchRequestCancelRequest.signature;
    public streamId: string;
    public requestId: string;

    constructor(params: ISearchRequestCancelRequest) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for SearchRequestCancelRequest message`);
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
