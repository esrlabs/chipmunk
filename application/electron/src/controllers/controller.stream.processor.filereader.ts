import PipesState from './controller.stream.processor.pipe.state';
import BytesRowsMap from './controller.stream.processor.map';

export default class ControllerStreamFileReader {

    public map: BytesRowsMap;
    public pipes: PipesState;
    private _streamId: string;

    constructor(streamId: string) {
        this._streamId = streamId;
        this.pipes = new PipesState(this._streamId);
        this.map = new BytesRowsMap();
    }

}
