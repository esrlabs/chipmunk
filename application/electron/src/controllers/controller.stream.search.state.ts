import BytesRowsMap from './controller.stream.search.map';
import SearchUpdatesPostman from './controller.stream.search.postman';

export default class State {

    public map: BytesRowsMap;
    public postman: SearchUpdatesPostman;

    private _streamId: string;

    constructor(streamId: string) {
        this._streamId = streamId;
        this.map = new BytesRowsMap();
        this.postman = new SearchUpdatesPostman(this._streamId, this.map);
    }

}
