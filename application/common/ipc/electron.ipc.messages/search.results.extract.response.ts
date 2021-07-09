import { TExtractedValues } from '../../interfaces/interface.rust.api.general';

export interface ISearchResultExtractResponse {
    streamId: string;
    requestId: string;
    results: TExtractedValues;
    error?: string;
    duration: number;
}

export class SearchResultExtractResponse {
    public static signature: string = 'SearchResultExtractResponse';
    public signature: string = SearchResultExtractResponse.signature;
    public streamId: string;
    public requestId: string;
    public results: TExtractedValues;
    public duration: number;
    public error?: string;

    constructor(params: ISearchResultExtractResponse) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for SearchResultExtractResponse message`);
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
        if (params.error !== undefined && typeof params.error !== 'string') {
            throw new Error(`Field "error" should be defined as string`);
        }
        if (typeof params.duration !== 'number' || isNaN(params.duration) || !isFinite(params.duration)) {
            throw new Error(`Field "duration" should be defined as valid number`);
        }
        this.streamId = params.streamId;
        this.requestId = params.requestId;
        this.results = params.results;
        this.error = params.error;
        this.duration = params.duration;
    }
}
