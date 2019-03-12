import ServiceElectronIpc from '../services/service.electron.ipc';
import { IPCMessages, Subscription } from '../services/service.electron.ipc';
import { Observable, Subject } from 'rxjs';
import { ControllerSessionTabStreamOutput, IStreamPacket } from './controller.session.tab.stream.output';
import * as Toolkit from 'logviewer.client.toolkit';

export interface IControllerSessionStream {
    guid: string;
    transports: string[];
}

export class ControllerSessionTabStream {

    private _logger: Toolkit.Logger;
    private _guid: string;
    private _transports: string[];
    private _subjects = {
        write: new Subject<IStreamPacket>(),
        next: new Subject<void>(),
        clear: new Subject<void>(),
    };
    private _subscriptions: { [key: string]: Subscription | undefined } = { };
    private _output: ControllerSessionTabStreamOutput = new ControllerSessionTabStreamOutput();

    constructor(params: IControllerSessionStream) {
        this._guid = params.guid;
        this._transports = params.transports;
        this._logger = new Toolkit.Logger(`ControllerSessionTabStream: ${params.guid}`);
        this._ipc_onStreamData = this._ipc_onStreamData.bind(this);
        // Notify electron about new stream
        ServiceElectronIpc.send(new IPCMessages.StreamAdd({
            guid: this._guid,
            transports: this._transports.slice(),
        }));
        // Subscribe to streams data
        ServiceElectronIpc.subscribe(IPCMessages.StreamData, this._ipc_onStreamData);
    }

    public destroy() {
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].destroy();
        });
    }

    public getGuid(): string {
        return this._guid;
    }

    public getOutputStream(): ControllerSessionTabStreamOutput {
        return this._output;
    }

    public getObservable(): {
        write: Observable<IStreamPacket>,
        next: Observable<void>,
        clear: Observable<void>
    } {
        return {
            write: this._subjects.write.asObservable(),
            next: this._subjects.next.asObservable(),
            clear: this._subjects.clear.asObservable()
        };
    }

    private _ipc_onStreamData(message: IPCMessages.StreamData) {
        const BreakRegExp = /[\r\n]/gm;
        const output: string = message.data.replace(BreakRegExp, '\n').replace(/\n{2,}/g, '\n');
        const rows: string[] = output.split(/\n/gi);
        if (rows.length === 1) {
            this._subjects.write.next(this._output.write(output, message.pluginId));
        } else {
            rows.forEach((row: string, index: number) => {
                this._subjects.write.next(this._output.write(row, message.pluginId));
                if (index !== rows.length - 1) {
                    this._output.next();
                    this._subjects.next.next();
                }
            });
        }
    }

}
