export interface ISearchIndexAroundRequest {
    session: string;
    position: number;
}

export class SearchIndexAroundRequest {

    public static signature: string = 'SearchIndexAroundRequest';
    public signature: string = SearchIndexAroundRequest.signature;
    public session: string;
    public position: number;

    constructor(params: ISearchIndexAroundRequest) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for SearchIndexAroundRequest message`);
        }
        if (typeof params.session !== 'string' || params.session.trim() === '') {
            throw new Error(`session should be not empty string.`);
        }
        if (typeof params.position !== 'number' || isNaN(params.position) || !isFinite(params.position)) {
            throw new Error(`position should be not empty string.`);
        }
        this.session = params.session;
        this.position = params.position;
    }
}
