export interface ISearchResultMapUpdated {
    streamId: string;
}

export class SearchResultMapUpdated {
    public static signature: string = 'SearchResultMapUpdated';
    public signature: string = SearchResultMapUpdated.signature;
    public streamId: string;

    constructor(params: ISearchResultMapUpdated) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for SearchResultMapUpdated message`);
        }
        if (typeof params.streamId !== 'string' || params.streamId.trim() === '') {
            throw new Error(`Field "streamId" should be defined`);
        }
        this.streamId = params.streamId;
    }

}
