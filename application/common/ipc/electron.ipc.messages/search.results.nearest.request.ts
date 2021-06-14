export interface ISearchResultNearestRequest {
    streamId: string;
    positionInStream: number;
}

export class SearchResultNearestRequest {
    public static readonly signature: string = 'SearchResultNearestRequest';
    public readonly signature: string = SearchResultNearestRequest.signature;
    public readonly streamId: string;
    public readonly positionInStream: number;

    constructor(params: ISearchResultNearestRequest) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for SearchResultNearestRequest message`);
        }
        if (typeof params.streamId !== 'string' || params.streamId.trim() === '') {
            throw new Error(`Field "streamId" should be defined`);
        }
        if (typeof params.positionInStream !== 'number' || isNaN(params.positionInStream) || !isFinite(params.positionInStream)) {
            throw new Error(`Field "positionInStream" should be valid number`);
        }
        this.streamId = params.streamId;
        this.positionInStream = params.positionInStream;
    }

}
