export interface ISearchResultMapData {
    stats: { [key: string]: number };
    map: { [key: number]: { [key: string ]: number } };
}

export interface ISearchResultMapResponse {
    streamId: string;
    scaled: ISearchResultMapData;
    data?: string;
}

export class SearchResultMapResponse {
    public static signature: string = 'SearchResultMapResponse';
    public signature: string = SearchResultMapResponse.signature;
    public streamId: string;
    public data: string;

    constructor(params: ISearchResultMapResponse) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for SearchResultMapResponse message`);
        }
        if (typeof params.streamId !== 'string' || params.streamId.trim() === '') {
            throw new Error(`Field "streamId" should be defined`);
        }
        if (typeof params.scaled === 'object' && params.scaled !== null) {
            this.data = JSON.stringify(params.scaled);
        } else if (typeof params.data === 'string' ) {
            this.data = params.data;
        } else {
            this.data = '';
        }
        this.streamId = params.streamId;
    }

    public getData(): ISearchResultMapData {
        return JSON.parse(this.data);
    }
}
