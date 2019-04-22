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
        matches: number[],
    } = {
        matches: [],
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
    } {
        return {
            write: this._subjects.write.asObservable(),
            next: this._subjects.next.asObservable(),
            clear: this._subjects.clear.asObservable(),
        };
    }

    public search(requestId: string, requests: RegExp[]): Promise<number> {
        return new Promise((resolve, reject) => {
            if (this._activeRequest !== undefined) {
                return reject(new Error(`Cannot start new search request while current isn't finished.`));
            }
            // Drop results
            this._results = {
                matches: [],
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
                this._logger.env(`Search request ${results.requestId} was finished in ${((results.duration) / 1000).toFixed(2)}s.`);
                if (results.error !== undefined) {
                    // Some error during processing search request
                    this._logger.error(`Search request id ${results.requestId} was finished with error: ${results.error}`);
                    return reject(new Error(results.error));
                }
                // Request is finished successful
                resolve(results.found);
                // Share results
                OutputParsersService.setSearchResults(this._guid, requests);
                // Update stream for render
                this._output.updateStreamState(results);
            }).catch((error: Error) => {
                reject(error);
            });
        });
    }

    public getCloseToMatch(row: number): { row: number, index: number } {
        if (this._results.matches.length === 0) {
            return { row: -1, index: -1 };
        }
        for (let i = this._results.matches.length - 1; i >= 0; i -= 1) {
            const cur: number = this._results.matches[i];
            if (cur === row) {
                return { row: row, index: i };
            }
            if (cur < row) {
                if (i !== this._results.matches.length - 1) {
                    const prev: number = this._results.matches[i + 1];
                    return { row: (row - cur) < (prev - row) ? cur : prev, index: (row - cur) < (prev - row) ? i : (i + 1)};
                }
                return { row: cur, index: i};
            }
        }
        return { row: this._results.matches[0], index: 0 };
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
