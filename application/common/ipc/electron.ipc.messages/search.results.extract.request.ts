import { IFilter } from '../../interfaces/interface.rust.api.general';

export interface ISearchResultExtractRequest {
    streamId: string;
    requestId: string;
    filters: IFilter[];
}

export class SearchResultExtractRequest {
    public static signature: string = 'SearchResultExtractRequest';
    public signature: string = SearchResultExtractRequest.signature;
    public streamId: string;
    public requestId: string;
    public filters: IFilter[];

    constructor(params: ISearchResultExtractRequest) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for SearchResultExtractRequest message`);
        }
        if (typeof params.streamId !== 'string' || params.streamId.trim() === '') {
            throw new Error(`Field "streamId" should be defined`);
        }
        if (typeof params.requestId !== 'string' || params.requestId.trim() === '') {
            throw new Error(`Field "requestId" should be defined`);
        }
        if (!(params.filters instanceof Array)) {
            throw new Error(`Field "filters" should be an instance of IFilter[]`);
        }
        this.streamId = params.streamId;
        this.requestId = params.requestId;
        this.filters = params.filters;
    }
}
