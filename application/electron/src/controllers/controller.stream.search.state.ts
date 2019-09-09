import BytesRowsMap from './controller.stream.search.map.state';
import SearchUpdatesPostman from './controller.stream.search.postman';

export default class State {

    public map: BytesRowsMap;
    public postman: SearchUpdatesPostman;

    private _streamId: string;
    private _searchFile: string;
    private _streamFile: string;

    constructor(streamId: string, streamFile: string, searchFile: string) {
        this._streamId = streamId;
        this._searchFile = searchFile;
        this._streamFile = streamFile;
        this.map = new BytesRowsMap();
        this.postman = new SearchUpdatesPostman(this._streamId, this.map);
    }

    public getStreamFile(): string {
        return this._streamFile;
    }

    public getSearchFile(): string {
        return this._searchFile;
    }

    public getGuid(): string {
        return this._streamId;
    }

}
