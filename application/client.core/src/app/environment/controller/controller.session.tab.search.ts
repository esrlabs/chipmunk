import { Observable, Subject } from 'rxjs';
import { ControllerSessionTabStream, IStreamPacket } from './controller.session.tab.stream';
import { ControllerSessionTabStreamSearch, ISearchPacket } from './controller.session.tab.search.output';
import ElectronIpcService, { IPCMessages } from '../services/service.electron.ipc';
import * as Toolkit from 'logviewer.client.toolkit';

export interface IControllerSessionStream {
    guid: string;
    stream: ControllerSessionTabStream;
}

export class ControllerSessionTabSearch {

    private _logger: Toolkit.Logger;
    private _guid: string;
    private _stream: ControllerSessionTabStream;
    private _subjects = {
        next: new Subject<ISearchPacket>(),
        clear: new Subject<void>(),
    };
    private _output: ControllerSessionTabStreamSearch = new ControllerSessionTabStreamSearch();
    private _subscriptions: { [key: string]: Toolkit.Subscription | undefined } = { };
    private _request: {
        id: string,
        resolve: (...args: any[]) => any,
        reject: (error: Error) => any,
        started: number,
        finished: number,
    } | undefined;

    constructor(params: IControllerSessionStream) {
        this._guid = params.guid;
        this._stream = params.stream;
        this._logger = new Toolkit.Logger(`ControllerSessionTabSearch: ${params.guid}`);
        this._subscriptions.onSearchStarted = ElectronIpcService.subscribe(IPCMessages.SearchRequestStarted, this._ipc_onSearchStarted.bind(this));
        this._subscriptions.onSearchFinished = ElectronIpcService.subscribe(IPCMessages.SearchRequestFinished, this._ipc_onSearchFinished.bind(this));
        this._subscriptions.onSearchResults = ElectronIpcService.subscribe(IPCMessages.SearchRequestResults, this._ipc_onSearchResults.bind(this));
    }

    public destroy() {
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
        });
    }

    public getGuid(): string {
        return this._guid;
    }

    public getOutputStream(): ControllerSessionTabStreamSearch {
        return this._output;
    }

    public getObservable(): {
        next: Observable<ISearchPacket>,
        clear: Observable<void>
    } {
        return {
            next: this._subjects.next.asObservable(),
            clear: this._subjects.clear.asObservable()
        };
    }

    public search(requests: RegExp[]): Promise<string> {
        return new Promise((resolve, reject) => {
            if (this._request !== undefined) {
                return reject(new Error(`Cannot start new search request while current isn't finished.`));
            }
            const requestId: string = Toolkit.guid();
            ElectronIpcService.send(new IPCMessages.SearchRequest({
                requests: requests.map((reg: RegExp) => {
                    return {
                        source: reg.source,
                        flags: reg.flags
                    };
                }),
                streamId: this._guid,
                requestId: requestId,
            })).then(() => {
                // Do not resolve now, because method "search" should be resolved after
                // search request was processed complitely
                this._request = {
                    id: requestId,
                    resolve: resolve,
                    reject: reject,
                    started: -1,
                    finished: -1
                };
            }).catch((error: Error) => {
                reject(error);
            });
        });
    }

    private _isIPCMessageBelongController(message: IPCMessages.SearchRequestStarted | IPCMessages.SearchRequestFinished | IPCMessages.SearchRequestResults): boolean {
        if (this._request === undefined) {
            return false;
        }
        if (this._request.id !== message.requestId) {
            return false;
        }
        return true;
    }

    private _ipc_onSearchStarted(message: IPCMessages.SearchRequestStarted) {
        if (!this._isIPCMessageBelongController(message)) {
            return;
        }
        this._request.started = Date.now();
        this._logger.env(`Search request ${message.requestId} is started.`);
    }

    private _ipc_onSearchFinished(message: IPCMessages.SearchRequestFinished) {
        if (!this._isIPCMessageBelongController(message)) {
            return;
        }
        this._request.finished = Date.now();
        this._logger.env(`Search request ${message.requestId} was finished in ${((this._request.finished - this._request.started) / 1000).toFixed(2)}s (process time is ${(message.duration / 1000).toFixed(2)}s).`);
        if (message.error !== undefined) {
            // Some error during processing search request
            this._logger.error(`Search request id ${message.requestId} was finished with error: ${message.error}`);
            return this._request.reject(new Error(message.error));
        }
        // Request is finished successful
        this._request.resolve(message.duration);
        // Drop request data
        this._request = undefined;
    }

    private _ipc_onSearchResults(message: IPCMessages.SearchRequestResults) {
        if (!this._isIPCMessageBelongController(message)) {
            return;
        }
        this._logger.env(`Search request ${message.requestId} results recieved.`);
        // Store all indexes from all requests
        let indexes: number[] = [];
        Object.keys(message.results).forEach((regKey: string) => {
            indexes.push(...message.results[regKey]);
        });
        // Remove duplicates
        const indexesSet: Set<number> = new Set(indexes);
        // Sort indexes
        indexes = Array.from(indexesSet).sort((a, b) => a - b);
        // Get rows
        const rows: IStreamPacket[] = this._stream.getRowsByIndexes(indexes);
        rows.forEach((row: IStreamPacket) => {
            this._output.add(row.original, row.pluginId);
        });
    }


}
