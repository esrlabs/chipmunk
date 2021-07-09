export interface ISearchResultNearestResponse {
    streamId: string;
    positionInSearch: number;
    positionInStream: number;
    error?: string;
}

export class SearchResultNearestResponse {
    public static readonly signature: string = 'SearchResultNearestResponse';
    public readonly signature: string = SearchResultNearestResponse.signature;
    public readonly streamId: string;
    public readonly positionInSearch: number;
    public readonly positionInStream: number;
    public readonly error?: string;

    constructor(params: ISearchResultNearestResponse) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for SearchResultNearestResponse message`);
        }
        if (typeof params.streamId !== 'string' || params.streamId.trim() === '') {
            throw new Error(`Field "streamId" should be defined`);
        }
        if (typeof params.positionInStream !== 'number' || isNaN(params.positionInStream) || !isFinite(params.positionInStream)) {
            throw new Error(`Field "positionInStream" should be valid number`);
        }
        if (typeof params.positionInSearch !== 'number' || isNaN(params.positionInSearch) || !isFinite(params.positionInSearch)) {
            throw new Error(`Field "positionInSearch" should be valid number`);
        }
        this.streamId = params.streamId;
        this.positionInSearch = params.positionInSearch;
        this.positionInStream = params.positionInStream;
        this.error = params.error;
    }

}
