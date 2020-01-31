export interface ISearchExpressionFlags {
    casesensitive: boolean;
    wholeword: boolean;
    regexp: boolean;
}

export interface ISearchExpression {
    request: string;
    flags: ISearchExpressionFlags;
}

export interface ISearchRequest {
    session: string;
    id: string;
    requests: ISearchExpression[];
}

export class SearchRequest {
    public static signature: string = 'SearchRequest';
    public signature: string = SearchRequest.signature;
    public session: string;
    public id: string;
    public requests: ISearchExpression[];

    constructor(params: ISearchRequest) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for SearchRequest message`);
        }
        if (typeof params.session !== 'string' || params.session.trim() === '') {
            throw new Error(`Field "session" should be defined`);
        }
        if (typeof params.id !== 'string' || params.id.trim() === '') {
            throw new Error(`Field "id" should be defined`);
        }
        if (!(params.requests instanceof Array)) {
            throw new Error(`Field "request" should be an instance of ISearchExpression[]`);
        }
        this.session = params.session;
        this.id = params.id;
        this.requests = params.requests;
    }
}
