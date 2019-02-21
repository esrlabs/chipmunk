import ServiceElectronIpc from '../services/service.electron.ipc';
import { IPCMessages, Subscription } from '../services/service.electron.ipc';
import { Observable, Subject } from 'rxjs';
import { ControllerSessionStreamOutput } from './controller.session.stream.output';
import * as Tools from '../tools/index';

export interface IControllerSessionStream {
    guid: string;
}

export interface IStreamPacket {
    original: string;
}

export class ControllerSessionStream {

    private _logger: Tools.Logger;
    private _guid: string;
    private _subjects = {
        new: new Subject<IStreamPacket>(),
        clear: new Subject<void>(),
    };
    private _subscriptions: { [key: string]: Subscription | undefined } = { };
    private _output: ControllerSessionStreamOutput = new ControllerSessionStreamOutput();

    constructor(params: IControllerSessionStream) {
        this._guid = params.guid;
        this._logger = new Tools.Logger(`ControllerSessionStream: ${params.guid}`);
        setInterval(() => {
            const original = `${Math.random().toFixed(10)}-${Math.random().toFixed(10)}-${Math.random().toFixed(10)}-${Math.random().toFixed(10)}`;
            this._subjects.new.next({
                original: original
            });
            this._output.pushToStream({
                original: original
            });
        }, Math.random() * 500);
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

}
