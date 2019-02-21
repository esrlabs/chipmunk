import ServiceElectronIpc from '../services/service.electron.ipc';
import { IPCMessages, Subscription } from '../services/service.electron.ipc';
import { ControllerSessionStream } from './controller.session.stream';
import * as Tools from '../tools/index';

export interface IControllerSession {
    guid: string;
}

export class ControllerSession {

    private _logger: Tools.Logger;
    private _guid: string;
    private _stream: ControllerSessionStream;

    private _subscriptions: { [key: string]: Subscription | undefined } = {
    };

    constructor(params: IControllerSession) {
        this._guid = params.guid;
        this._logger  = new Tools.Logger(`ControllerSession: ${params.guid}`);
        this._stream = new ControllerSessionStream({ guid: params.guid });
    }

    public destroy() {
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].destroy();
        });
    }

    public getGuid(): string {
        return this._guid;
    }

    public getSessionStream(): ControllerSessionStream {
        return this._stream;
    }


}
