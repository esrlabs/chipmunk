import ServiceElectronIpc, { IPCMessages, Subscription } from '../services/service.electron.ipc';
import { Observable, Subject } from 'rxjs';
import { ControllerSessionTabStreamOutput, IStreamPacket } from './controller.session.tab.stream.output';
import { ControllerSessionTabStreamBookmarks } from './controller.session.tab.stream.bookmarks';
import QueueService, { IQueueController } from '../services/standalone/service.queue';
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
    private _bookmarks: ControllerSessionTabStreamBookmarks;

    constructor(params: IControllerSessionStream) {
        this._guid = params.guid;
        this._transports = params.transports;
        this._logger = new Toolkit.Logger(`ControllerSessionTabStream: ${params.guid}`);
        this._bookmarks = new ControllerSessionTabStreamBookmarks(params.guid);
        this._output = new ControllerSessionTabStreamOutput(params.guid, this._requestData.bind(this), this._bookmarks);
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
        ServiceElectronIpc.subscribe(IPCMessages.StreamUpdated, this._ipc_onStreamUpdated.bind(this));
    }

    public destroy() {
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].destroy();
        });
        this._output.destroy();
        this._bookmarks.destroy();
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

    public getBookmarks(): ControllerSessionTabStreamBookmarks {
        return this._bookmarks;
    }

    private _requestData(start: number, end: number): Promise<IPCMessages.StreamChunk> {
        return new Promise((resolve, reject) => {
            const s = Date.now();
            ServiceElectronIpc.request(
                new IPCMessages.StreamChunk({
                    guid: this._guid,
                    start: start,
                    end: end
                }), IPCMessages.StreamChunk
            ).then((response: IPCMessages.StreamChunk) => {
                this._logger.env(`Chunk [${start} - ${end}] is read in: ${((Date.now() - s) / 1000).toFixed(2)}s`);
                if (response.error !== undefined) {
                    return reject(new Error(this._logger.warn(`Request to stream chunk was finished within error: ${response.error}`)));
                }
                resolve(response);
            });
        });
    }

    private _ipc_onStreamUpdated(message: IPCMessages.StreamUpdated) {
        if (this._guid !== message.guid) {
            return;
        }
        this._output.updateStreamState(message);
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
