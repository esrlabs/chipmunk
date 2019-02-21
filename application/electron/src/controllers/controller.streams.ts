import Logger from '../../platform/node/src/env.logger';
import ControllerElectronIpc from './controller.electron.ipc';

export default class ControllerStreams {

    private _guid: string;
    private _logger: Logger;
    private _ipc: ControllerElectronIpc | undefined;

    constructor(guid: string, ipc: ControllerElectronIpc) {
        this._guid = guid;
        this._logger = new Logger(`ControllerStreams: ${guid}`);
        this._ipc = ipc;
    }

    public destroy() {

    }

}
