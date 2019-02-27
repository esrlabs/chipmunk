import ServiceElectronIpc from '../services/service.electron.ipc';
import { IPCMessages, Subscription } from '../services/service.electron.ipc';
import { Observable, Subject } from 'rxjs';
import { ControllerSessionStreamOutput } from './controller.session.stream.output';
import * as Tools from '../tools/index';

export interface IControllerSessionStream {
    guid: string;
    transports: string[];
}

export interface IStreamPacket {
    original: string;
}

export class ControllerSessionStream {

    private _logger: Tools.Logger;
    private _guid: string;
    private _transports: string[];
    private _subjects = {
        new: new Subject<IStreamPacket>(),
        clear: new Subject<void>(),
    };
    private _subscriptions: { [key: string]: Subscription | undefined } = { };
    private _output: ControllerSessionStreamOutput = new ControllerSessionStreamOutput();

    constructor(params: IControllerSessionStream) {
        this._guid = params.guid;
        this._transports = params.transports;
        this._logger = new Tools.Logger(`ControllerSessionStream: ${params.guid}`);
        this._ipc_onStreamData = this._ipc_onStreamData.bind(this);
        // Notify electron about new stream
        ServiceElectronIpc.send(new IPCMessages.StreamAdd({
            guid: this._guid,
            transports: this._transports.slice(),
        }));
        // Subscribe to streams data
        ServiceElectronIpc.subscribe(IPCMessages.StreamData, this._ipc_onStreamData);
        /*
        setInterval(() => {
            const original = `${Math.random().toFixed(10)}-${Math.random().toFixed(10)}-${Math.random().toFixed(10)}-${Math.random().toFixed(10)}`;
            this._subjects.new.next({
                original: original
            });
            this._output.pushToStream({
                original: original
            });
        }, Math.random() * 500);
        */
    }

    public destroy() {
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].destroy();
        });
    }

    public getGuid(): string {
        return this._guid;
    }

    public getOutputStream(): ControllerSessionStreamOutput {
        return this._output;
    }

    public getObservable(): {
        new: Observable<IStreamPacket>,
        clear: Observable<void>,
    } {
        return {
            new: this._subjects.new.asObservable(),
            clear: this._subjects.clear.asObservable(),
        };
    }

    private _ipc_onStreamData(message: IPCMessages.StreamData) {
        message.data.split(/[\n\r]/gi).forEach((row: string) => {
            this._subjects.new.next({
                original: row
            });
            this._output.pushToStream({
                original: row
            });
        });
    }

}
