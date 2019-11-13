
export default class State {

    private _streamId: string;
    private _streamFile: string;

    constructor(streamId: string, streamFile: string, searchFile: string) {
        this._streamId = streamId;
        this._streamFile = streamFile;
    }

    public getStreamFile(): string {
        return this._streamFile;
    }

    public getGuid(): string {
        return this._streamId;
    }

}
