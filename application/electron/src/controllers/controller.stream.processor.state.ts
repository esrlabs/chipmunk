import PipesState from './controller.stream.processor.pipe.state';
import ProgressState from './controller.stream.processor.progress.state';
import BytesRowsMap from './controller.stream.processor.map';
import StreamUpdatesPostman from './controller.stream.processor.postman';
import ControllerStreamFileReader from './controller.stream.file.reader';

export default class State {

    public map: BytesRowsMap;
    public pipes: PipesState;
    public postman: StreamUpdatesPostman;
    public reader: ControllerStreamFileReader;
    public progress: ProgressState;

    private _streamId: string;
    private _file: string;

    constructor(streamId: string, file: string) {
        this._streamId = streamId;
        this._file = file;
        this.pipes = new PipesState(this._streamId);
        this.progress = new ProgressState(this._streamId);
        this.map = new BytesRowsMap();
        this.reader = new ControllerStreamFileReader(this._streamId, this._file);
        this.postman = new StreamUpdatesPostman(this._streamId, this.map);
    }

    public destroy() {
        this.reader.destroy();
        this.postman.destroy();
        this.map.destroy();
        this.pipes.destroy();
        this.progress.destroy();
    }

}
