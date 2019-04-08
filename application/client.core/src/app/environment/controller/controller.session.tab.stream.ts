import ServiceElectronIpc, { IPCMessages, Subscription } from '../services/service.electron.ipc';
import { Observable, Subject } from 'rxjs';
import { ControllerSessionTabStreamOutput, IStreamPacket, TRequestDataHandler, BufferSettings, IRange } from './controller.session.tab.stream.output';
import QueueService, { IQueueController } from '../services/parallels/service.queue';
import * as Toolkit from 'logviewer.client.toolkit';

export { ControllerSessionTabStreamOutput, IStreamPacket };

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
    private _output: ControllerSessionTabStreamOutput;

    constructor(params: IControllerSessionStream) {
        this._guid = params.guid;
        this._transports = params.transports;
        this._logger = new Toolkit.Logger(`ControllerSessionTabStream: ${params.guid}`);
        this._output = new ControllerSessionTabStreamOutput(params.guid, this._requestData.bind(this));
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
        this._ipc_onStreamUpdated = this._ipc_onStreamUpdated.bind(this);
        ServiceElectronIpc.subscribe(IPCMessages.StreamData, this._ipc_onStreamData);
        ServiceElectronIpc.subscribe(IPCMessages.StreamUpdated, this._ipc_onStreamUpdated);
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

    private _requestData(start: number, end: number): Promise<Error | number> {
        return new Promise((resolve) => {
            const s = Date.now();
            ServiceElectronIpc.request(
                new IPCMessages.StreamChunk({
                    guid: this._guid,
                    start: start,
                    end: end
                })
            ).then((response: IPCMessages.StreamChunk) => {
                const duration: number = Date.now() - s;
                this._logger.env(`Chunk [${start} - ${end}] is read in: ${(duration / 1000).toFixed(2)}s`);
                if (response.error !== undefined) {
                    return resolve(new Error(this._logger.warn(`Request to stream chunk was finished within error: ${response.error}`)));
                }
                this._output.update(response.data, response.start, response.end, response.rows);
                resolve(duration);
            });
        });
    }

    private _ipc_onStreamData(message: IPCMessages.StreamData) {
        /*
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
            }
        });
        */
    }

    private _ipc_onStreamUpdated(message: IPCMessages.StreamUpdated) {
        if (this._guid !== message.guid) {
            return;
        }
        const requestedRange: IRange | undefined = this._output.updateStreamState(message);
        if (requestedRange === undefined) {
            return;
        }
        this._requestData(requestedRange.start, requestedRange.end);
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
