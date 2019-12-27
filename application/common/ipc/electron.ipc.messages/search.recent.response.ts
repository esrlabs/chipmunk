export interface IRecentSearchRequest {
    request: string;
    used: number;
}

export interface ISearchRecentResponse {
    requests: IRecentSearchRequest[];
    error?: string;
}

export class SearchRecentResponse {

    public static signature: string = 'SearchRecentResponse';
    public signature: string = SearchRecentResponse.signature;
    public requests: IRecentSearchRequest[] = [];
    public error: string | undefined;

    constructor(params: ISearchRecentResponse) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for SearchRecentResponse message`);
        }
        if (!(params.requests instanceof Array)) {
            throw new Error(`requests should be defined.`);
        }
        this.requests = params.requests;
        this.error = params.error;
    }
}
