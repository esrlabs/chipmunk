import ServiceElectronIpc, { IPCMessages, Subscription as IPCSubscription } from '../services/service.electron.ipc';
import { Observable, Subject, Subscription } from 'rxjs';
import { ControllerSessionTabStreamOutput, IStreamPacket, IStreamState } from './controller.session.tab.stream.output';
import { ControllerSessionTabStreamBookmarks } from './controller.session.tab.stream.bookmarks';
import { ControllerSessionScope } from './controller.session.tab.scope';
import QueueService, { IQueueController } from '../services/standalone/service.queue';
import * as Toolkit from 'chipmunk.client.toolkit';

export { ControllerSessionTabStreamOutput, IStreamPacket, IStreamState };

export interface IControllerSessionStream {
    guid: string;
    scope: ControllerSessionScope;
}

export class ControllerSessionTabStream {

    private _logger: Toolkit.Logger;
    private _queue: Toolkit.Queue;
    private _queueController: IQueueController | undefined;
    private _guid: string;
    private _subjects = {
        onSourceChanged: new Subject<number>(),
    };
    private _subscriptions: { [key: string]: Subscription | IPCSubscription } = { };
    private _output: ControllerSessionTabStreamOutput;
    private _bookmarks: ControllerSessionTabStreamBookmarks;
    private _scope: ControllerSessionScope;

    constructor(params: IControllerSessionStream) {
        this._guid = params.guid;
        this._scope = params.scope;
        this._logger = new Toolkit.Logger(`ControllerSessionTabStream: ${params.guid}`);
        this._bookmarks = new ControllerSessionTabStreamBookmarks(params.guid);
        this._output = new ControllerSessionTabStreamOutput({
            guid: params.guid,
            requestDataHandler: this._requestData.bind(this),
            bookmarks: this._bookmarks,
            scope: this._scope,
        });
        this._queue = new Toolkit.Queue(this._logger.error.bind(this._logger), 0);
        // Subscribe to queue events
        this._queue_onDone = this._queue_onDone.bind(this);
        this._queue_onNext = this._queue_onNext.bind(this);
        this._queue.subscribe(Toolkit.Queue.Events.done, this._queue_onDone);
        this._queue.subscribe(Toolkit.Queue.Events.next, this._queue_onNext);
        // Subscribe to streams data
        this._subscriptions.onStreamUpdated = ServiceElectronIpc.subscribe(IPCMessages.StreamUpdated, this._ipc_onStreamUpdated.bind(this));
    }

    public destroy(): Promise<void> {
        return new Promise((resolve, reject) => {
            Object.keys(this._subscriptions).forEach((key: string) => {
                this._subscriptions[key].unsubscribe();
            });
            this._output.destroy();
            this._bookmarks.destroy();
            this._queue.unsubscribeAll();
            resolve();
        });
    }

    public init(): Promise<void> {
        return new Promise((resolve, reject) => {
            // Notify electron about new stream
            ServiceElectronIpc.request(new IPCMessages.StreamAddRequest({
                guid: this._guid,
            }), IPCMessages.StreamAddResponse).then((response: IPCMessages.StreamAddResponse) => {
                if (response.error) {
                    return reject(new Error(`Fail to init stream due error: ${response.error}`));
                }
                this._logger.env(`Stream "${response.guid}" is inited`);
                resolve();
            }).catch((error: Error) => {
                reject(error);
            });
        });
    }

    public getGuid(): string {
        return this._guid;
    }

    public getOutputStream(): ControllerSessionTabStreamOutput {
        return this._output;
    }

    public getObservable(): {
        onSourceChanged: Observable<number>,
    } {
        return {
            onSourceChanged: this._output.getObservable().onSourceChanged,
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
