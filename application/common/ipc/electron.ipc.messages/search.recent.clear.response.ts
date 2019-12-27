export interface ISearchRecentClearResponse {
    error?: string;
}

export class SearchRecentClearResponse {

    public static signature: string = 'SearchRecentClearResponse';
    public signature: string = SearchRecentClearResponse.signature;
    public error: string | undefined;

    constructor(params: ISearchRecentClearResponse) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for SearchRecentClearResponse message`);
        }
        this.error = params.error;
    }
}
