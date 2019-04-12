import { Observable, Subject } from 'rxjs';
import { ControllerSessionTabSearchOutput } from './controller.session.tab.search.output';
import { ControllerSessionTabStreamOutput } from './controller.session.tab.stream.output';
import QueueService, { IQueueController } from '../services/standalone/service.queue';
import * as Toolkit from 'logviewer.client.toolkit';
import ServiceElectronIpc, { IPCMessages, Subscription } from '../services/service.electron.ipc';
import OutputParsersService from '../services/standalone/service.output.parsers';

export interface IControllerSessionStream {
    guid: string;
    stream: ControllerSessionTabStreamOutput;
    transports: string[];
}

export class ControllerSessionTabSearch {

    private _logger: Toolkit.Logger;
    private _queue: Toolkit.Queue;
    private _queueController: IQueueController | undefined;
    private _guid: string;
    private _transports: string[];
    private _subjects = {
        write: new Subject<void>(),
        next: new Subject<void>(),
        clear: new Subject<void>(),
        onSearchStarted: new Subject<string>(),
        onSearchFinished: new Subject<string>()
    };
    private _subscriptions: { [key: string]: Subscription | undefined } = { };
    private _output: ControllerSessionTabSearchOutput;
    private _activeRequest: {
        id: string,
        resolve: (...args: any[]) => any,
        reject: (error: Error) => any,
        started: number,
        finished: number,
    } | undefined;
    private _results: {
        indexes: { [key: number]: number[] },
        regs: RegExp[]
    } = {
        indexes: [],
        regs: [],
    };

    constructor(params: IControllerSessionStream) {
        this._guid = params.guid;
        this._transports = params.transports;
        this._logger = new Toolkit.Logger(`ControllerSessionTabSearch: ${params.guid}`);
        this._output = new ControllerSessionTabSearchOutput(params.guid, this._requestStreamData.bind(this), params.stream);
        this._queue = new Toolkit.Queue(this._logger.error.bind(this._logger), 0);
        // Subscribe to queue events
        this._queue_onDone = this._queue_onDone.bind(this);
        this._queue_onNext = this._queue_onNext.bind(this);
        this._queue.subscribe(Toolkit.Queue.Events.done, this._queue_onDone);
        this._queue.subscribe(Toolkit.Queue.Events.next, this._queue_onNext);
        // Subscribe to streams data
        this._ipc_onSearchStreamUpdated = this._ipc_onSearchStreamUpdated.bind(this);
        this._ipc_onSearchStarted = this._ipc_onSearchStarted.bind(this);
        this._ipc_onSearchFinished = this._ipc_onSearchFinished.bind(this);
        this._subscriptions.SearchStreamUpdated = ServiceElectronIpc.subscribe(IPCMessages.SearchStreamUpdated, this._ipc_onSearchStreamUpdated);
        this._subscriptions.onSearchStarted = ServiceElectronIpc.subscribe(IPCMessages.SearchRequestStarted, this._ipc_onSearchStarted.bind(this));
        this._subscriptions.onSearchFinished = ServiceElectronIpc.subscribe(IPCMessages.SearchRequestFinished, this._ipc_onSearchFinished.bind(this));
    }

    public destroy() {
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].destroy();
        });
        this._queue.unsubscribeAll();
        OutputParsersService.unsetSearchResults(this._guid);
    }

    public getGuid(): string {
        return this._guid;
    }

    public getOutputStream(): ControllerSessionTabSearchOutput {
        return this._output;
    }

    public getObservable(): {
        write: Observable<void>,
        next: Observable<void>,
        clear: Observable<void>,
        onSearchStarted: Observable<string>,
        onSearchFinished: Observable<string>,
    } {
        return {
            write: this._subjects.write.asObservable(),
            next: this._subjects.next.asObservable(),
            clear: this._subjects.clear.asObservable(),
            onSearchStarted: this._subjects.onSearchStarted.asObservable(),
            onSearchFinished: this._subjects.onSearchFinished.asObservable(),
        };
    }

    public search(requestId: string, requests: RegExp[]): Promise<string> {
        return new Promise((resolve, reject) => {
            if (this._activeRequest !== undefined) {
                return reject(new Error(`Cannot start new search request while current isn't finished.`));
            }
            // Drop results
            this._results = {
                indexes: [],
                regs: [],
            };
            // Drop output
            this._output.clearStream();
            // Start search
            ServiceElectronIpc.request(new IPCMessages.SearchRequest({
                requests: requests.map((reg: RegExp) => {
                    return {
                        source: reg.source,
                        flags: reg.flags
                    };
                }),
                streamId: this._guid,
                requestId: requestId,
            }), IPCMessages.SearchRequestResults).then((results: IPCMessages.SearchRequestResults) => {
                // Do not resolve now, because method "search" should be resolved after
                // search request was processed complitely
                this._activeRequest = {
                    id: requestId,
                    resolve: resolve,
                    reject: reject,
                    started: -1,
                    finished: -1
                };
                // Save results
                this._results.indexes = results.results;
                this._results.regs = requests;
                // Share results
                OutputParsersService.setSearchResults(this._guid, requests, results.results);
            }).catch((error: Error) => {
                reject(error);
            });
        });
    }

    private _requestStreamData(start: number, end: number): Promise<IPCMessages.SearchChunk> {
        return new Promise((resolve, reject) => {
            const s = Date.now();
            ServiceElectronIpc.request(
                new IPCMessages.SearchChunk({
                    guid: this._guid,
                    start: start,
                    end: end
                })
            ).then((response: IPCMessages.SearchChunk) => {
                const duration: number = Date.now() - s;
                this._logger.env(`Chunk [${start} - ${end}] is read in: ${(duration / 1000).toFixed(2)}s`);
                if (response.error !== undefined) {
                    return reject(new Error(this._logger.warn(`Request to stream chunk was finished within error: ${response.error}`)));
                }
                resolve(response);
            });
        });
    }

    private _ipc_onSearchStreamUpdated(message: IPCMessages.SearchStreamUpdated) {
        if (this._guid !== message.guid) {
            return;
        }
        this._output.updateStreamState(message);
    }

    private _ipc_onSearchStarted(message: IPCMessages.SearchRequestStarted) {
        if (!this._isIPCMessageBelongController(message)) {
            return;
        }
        this._activeRequest.started = Date.now();
        this._subjects.onSearchStarted.next(this._activeRequest.id);
        this._logger.env(`Search request ${message.requestId} is started.`);
    }

    private _ipc_onSearchFinished(message: IPCMessages.SearchRequestFinished) {
        if (!this._isIPCMessageBelongController(message)) {
            return;
        }
        this._activeRequest.finished = Date.now();
        this._logger.env(`Search request ${message.requestId} was finished in ${((this._activeRequest.finished - this._activeRequest.started) / 1000).toFixed(2)}s (process time is ${(message.duration / 1000).toFixed(2)}s).`);
        if (message.error !== undefined) {
            // Some error during processing search request
            this._logger.error(`Search request id ${message.requestId} was finished with error: ${message.error}`);
            return this._activeRequest.reject(new Error(message.error));
        }
        // Request is finished successful
        this._activeRequest.resolve(message.duration);
        // Drop request data
        this._activeRequest = undefined;
        this._subjects.onSearchFinished.next(this._activeRequest.id);
    }

    private _isIPCMessageBelongController(message: IPCMessages.SearchRequestStarted | IPCMessages.SearchRequestFinished | IPCMessages.SearchRequestResults): boolean {
        if (this._activeRequest === undefined) {
            return false;
        }
        if (this._activeRequest.id !== message.requestId) {
            return false;
        }
        return true;
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
