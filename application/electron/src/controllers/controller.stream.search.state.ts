import BytesRowsMap from './controller.stream.search.map';

export default class State {

    public map: BytesRowsMap;
    private _streamId: string;

    constructor(streamId: string) {
        this._streamId = streamId;
        this.map = new BytesRowsMap();
    }

}
