export interface ISearchResultMapRequest {
    streamId: string;
    scale: number;
    range?: {
        begin: number;
        end: number;
    };
}

export class SearchResultMapRequest {
    public static readonly signature: string = 'SearchResultMapRequest';
    public readonly signature: string = SearchResultMapRequest.signature;
    public readonly streamId: string;
    public readonly scale: number;
    public readonly range?: {
        begin: number;
        end: number;
    };

    constructor(params: ISearchResultMapRequest) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for SearchResultMapRequest message`);
        }
        if (typeof params.streamId !== 'string' || params.streamId.trim() === '') {
            throw new Error(`Field "streamId" should be defined`);
        }
        if (typeof params.scale !== 'number' || isNaN(params.scale) || !isFinite(params.scale)) {
            throw new Error(`Field "scale" should be valid number`);
        }
        this.streamId = params.streamId;
        this.scale = params.scale;
        this.range = params.range;
    }

}
