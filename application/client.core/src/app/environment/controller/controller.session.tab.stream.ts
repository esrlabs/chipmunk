import ServiceElectronIpc from '../services/service.electron.ipc';
import { IPCMessages, Subscription } from '../services/service.electron.ipc';
import { Observable, Subject } from 'rxjs';
import { ControllerSessionTabStreamOutput, IStreamPacket } from './controller.session.tab.stream.output';
import QueueService, { IQueueController } from '../services/parallels/service.queue';
import * as Toolkit from 'logviewer.client.toolkit';

export {ControllerSessionTabStreamOutput, IStreamPacket};

export interface IControllerSessionStream {
    guid: string;
    transports: string[];
}

export class ControllerSessionTabStream {

    private _logger: Toolkit.Logger;
    private _queue: Toolkit.Queue;
    private _queueController: IQueueController | undefined;
    private _guid: string;
    private _transports: string[];
    private _subjects = {
        write: new Subject<void>(),
        next: new Subject<void>(),
        clear: new Subject<void>(),
    };
    private _subscriptions: { [key: string]: Subscription | undefined } = { };
    private _output: ControllerSessionTabStreamOutput = new ControllerSessionTabStreamOutput();

    constructor(params: IControllerSessionStream) {
        this._guid = params.guid;
        this._transports = params.transports;
        this._logger = new Toolkit.Logger(`ControllerSessionTabStream: ${params.guid}`);
        this._queue = new Toolkit.Queue(this._logger.error.bind(this._logger), 0);
        // Notify electron about new stream
        ServiceElectronIpc.send(new IPCMessages.StreamAdd({
            guid: this._guid,
            transports: this._transports.slice(),
        }));
        // Subscribe to queue events
        this._queue_onDone = this._queue_onDone.bind(this);
        this._queue_onNext = this._queue_onNext.bind(this);
        this._queue.subscribe(Toolkit.Queue.Events.done, this._queue_onDone);
        this._queue.subscribe(Toolkit.Queue.Events.next, this._queue_onNext);
        // Subscribe to streams data
        this._ipc_onStreamData = this._ipc_onStreamData.bind(this);
        ServiceElectronIpc.subscribe(IPCMessages.StreamData, this._ipc_onStreamData);
    }

    public destroy() {
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].destroy();
        });
        this._queue.unsubscribeAll();
    }

    public getGuid(): string {
        return this._guid;
    }

    public getOutputStream(): ControllerSessionTabStreamOutput {
        return this._output;
    }

    public getObservable(): {
        write: Observable<void>,
        next: Observable<void>,
        clear: Observable<void>
    } {
        return {
            write: this._subjects.write.asObservable(),
            next: this._subjects.next.asObservable(),
            clear: this._subjects.clear.asObservable()
        };
    }

    public getRowsByIndexes(indexes: number[]): IStreamPacket[] {
        return this._output.getRowsByIndexes(indexes);
    }

    private _ipc_onStreamData(message: IPCMessages.StreamData) {
        this._queue.add(() => {
            const BreakRegExp = /[\r\n]/gm;
            const output: string = message.data.replace(BreakRegExp, '\n').replace(/\n{2,}/g, '\n');
            const rows: string[] = output.split(/\n/gi);
            if (rows.length === 1) {
                this._output.write(output, message.pluginId);
                this._subjects.write.next();
            } else if (rows.length > 1) {
                const last: string = rows.splice(rows.length - 1, 1)[0];
                this._output.rows(rows, message.pluginId);
                this._output.write(last, message.pluginId);
                this._subjects.next.next();
                /*
                rows.forEach((row: string, index: number) => {
                    this._subjects.write.next(this._output.write(row, message.pluginId));
                    if (index !== rows.length - 1) {
                        this._output.next();
                        this._subjects.next.next();
                    }
                });
                */
            }
        });
    }

    private _queue_onNext(done: number, total: number) {
        if (this._queueController === undefined) {
            this._queueController = QueueService.create('reading');
        }
        this._queueController.next(done, total);
    }

    private _queue_onDone() {
        if (this._queueController === undefined) {
            return;
        }
        this._queueController.done();
        this._queueController = undefined;
    }

}
