import ProgressState from '../render/controller.progress';
import BytesRowsMap from './file.map';
import StreamUpdatesPostman from './postman';
import ControllerStreamFileReader from './file.reader';

export default class State {

    public map: BytesRowsMap;
    public postman: StreamUpdatesPostman;
    public reader: ControllerStreamFileReader;
    public progress: ProgressState;

    private _streamId: string;
    private _file: string;

    constructor(streamId: string, file: string) {
        this._streamId = streamId;
        this._file = file;
        this.progress = new ProgressState(this._streamId);
        this.map = new BytesRowsMap();
        this.reader = new ControllerStreamFileReader(this._streamId, this._file);
        this.postman = new StreamUpdatesPostman(this._streamId, this.map);
    }

    public destroy() {
        this.progress.destroy();
        this.reader.destroy();
        this.postman.destroy();
        this.map.destroy();
    }

}
