export interface ISearchRecentAddResponse {
    error?: string;
}

export class SearchRecentAddResponse {

    public static signature: string = 'SearchRecentAddResponse';
    public signature: string = SearchRecentAddResponse.signature;
    public error: string | undefined;

    constructor(params: ISearchRecentAddResponse) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for SearchRecentAddResponse message`);
        }
        this.error = params.error;
    }
}
