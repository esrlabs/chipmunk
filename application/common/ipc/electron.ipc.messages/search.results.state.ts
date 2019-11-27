export interface ISearchResultMapState {
    streamId: string;
    found: number;
}

export class SearchResultMapState {
    public static signature: string = 'SearchResultMapState';
    public signature: string = SearchResultMapState.signature;
    public streamId: string;
    public found: number;

    constructor(params: ISearchResultMapState) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for SearchResultMapState message`);
        }
        if (typeof params.streamId !== 'string' || params.streamId.trim() === '') {
            throw new Error(`Field "streamId" should be defined`);
        }
        if (typeof params.found !== 'number') {
            throw new Error(`Field "found" should be defined`);
        }
        this.streamId = params.streamId;
        this.found = params.found;
    }

}
