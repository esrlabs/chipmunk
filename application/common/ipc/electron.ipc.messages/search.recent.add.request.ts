export interface ISearchRecentAddRequest {
    request: string;
}

export class SearchRecentAddRequest {

    public static signature: string = 'SearchRecentAddRequest';
    public signature: string = SearchRecentAddRequest.signature;
    public request: string;

    constructor(params: ISearchRecentAddRequest) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for SearchRecentAddRequest message`);
        }
        if (typeof params.request !== 'string' || params.request.trim() === '') {
            throw new Error(`request should be not empty string.`);
        }
        this.request = params.request;
    }
}
