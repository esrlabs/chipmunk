export interface ISearchResultMap {
    streamId: string;
    append: boolean;
    stats: { [key: string]: number };
    map: { [key: number]: string[] };
    data?: string;
}

export interface ISearchResultMapData {
    stats: { [key: string]: number };
    map: { [key: number]: string[] };
}

export class SearchResultMap {
    public static signature: string = 'SearchResultMap';
    public signature: string = SearchResultMap.signature;
    public streamId: string;
    public append: boolean;
    public data: string;

    constructor(params: ISearchResultMap) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for SearchResultMap message`);
        }
        if (typeof params.streamId !== 'string' || params.streamId.trim() === '') {
            throw new Error(`Field "streamId" should be defined`);
        }
        if (typeof params.append !== 'boolean') {
            throw new Error(`Field "append" should be defined`);
        }
        if (typeof params.stats === 'object' && params.stats !== null && typeof params.map === 'object' && params.map !== null) {
            this.data = JSON.stringify({
                stats: params.stats,
                map: params.map,
            });
        } else if (typeof params.data === 'string' ) {
            this.data = params.data;
        } else {
            this.data = '';
        }
        this.streamId = params.streamId;
        this.append = params.append;
    }

    public getData(): ISearchResultMapData {
        return JSON.parse(this.data);
    }
}
