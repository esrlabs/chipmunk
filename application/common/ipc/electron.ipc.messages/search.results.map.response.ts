import { API } from '../../interfaces/index';

export interface ISearchResultMapResponse {
    streamId: string;
    map: API.ISearchMap;
    error?: string;
}

export class SearchResultMapResponse {
    public static readonly signature: string = 'SearchResultMapResponse';
    public readonly signature: string = SearchResultMapResponse.signature;
    public readonly streamId: string;
    public readonly map: API.ISearchMap;
    public readonly error?: string;

    constructor(params: ISearchResultMapResponse) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for SearchResultMapResponse message`);
        }
        if (typeof params.streamId !== 'string' || params.streamId.trim() === '') {
            throw new Error(`Field "streamId" should be defined`);
        }
        if (!(params.map instanceof Array)) {
            throw new Error(`Field "map" should be defined`);
        }
        this.streamId = params.streamId;
        this.map = params.map;
        this.error = params.error;
    }

}
