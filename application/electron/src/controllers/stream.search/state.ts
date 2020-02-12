import BytesRowsMap from "./file.map";
import SearchUpdatesPostman from "./postman";

export default class State {
    public map: BytesRowsMap;
    public postman: SearchUpdatesPostman;

    private _streamId: string;
    private _searchFile: string;
    private _streamFile: string;
    private _requests: RegExp[] = [];

    constructor(streamId: string, streamFile: string, searchFile: string) {
        this._streamId = streamId;
        this._searchFile = searchFile;
        this._streamFile = streamFile;
        this.map = new BytesRowsMap();
        this.postman = new SearchUpdatesPostman(this._streamId, this.map, this.hasActiveRequests.bind(this));
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

    public setRequests(requests: RegExp[]) {
        this._requests = requests;
    }

    public getRequests(): RegExp[] {
        return this._requests;
    }

    public hasActiveRequests(): boolean {
        return this._requests.length > 0;
    }
}
