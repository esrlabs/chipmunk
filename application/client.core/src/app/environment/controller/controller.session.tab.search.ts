import { Observable, Subject } from 'rxjs';
import { ControllerSessionTabStreamSearch, ISearchPacket } from './controller.session.tab.search.output';
import ElectronIpcService, { IPCMessages } from '../services/service.electron.ipc';
import * as Toolkit from 'logviewer.client.toolkit';

export interface IControllerSessionStream {
    guid: string;
}

export class ControllerSessionTabSearch {

    private _logger: Toolkit.Logger;
    private _guid: string;
    private _subjects = {
        next: new Subject<ISearchPacket>(),
        clear: new Subject<void>(),
    };
    private _output: ControllerSessionTabStreamSearch = new ControllerSessionTabStreamSearch();
    private _subscriptions: { [key: string]: Toolkit.Subscription | undefined } = { };
    private _request: {
        guid: string,
        resolve: (...args: any[]) => any,
        reject: (error: Error) => any,
        started: number,
        finished: number,
    } | undefined;

    constructor(params: IControllerSessionStream) {
        this._guid = params.guid;
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
                    guid: requestId,
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
        if (this._request.guid !== message.requestId) {
            return false;
        }
        return true;
    }

    private _ipc_onSearchStarted(message: IPCMessages.SearchRequestStarted) {
        if (!this._isIPCMessageBelongController(message)) {
            return;
        }
        this._request.started = Date.now();
        console.log('STARTED', message);
    }

    private _ipc_onSearchFinished(message: IPCMessages.SearchRequestFinished) {
        if (!this._isIPCMessageBelongController(message)) {
            return;
        }
        this._request.finished = Date.now();
        // Remove request data.
        console.log('FINISHED', message);
    }

    private _ipc_onSearchResults(message: IPCMessages.SearchRequestResults) {
        if (!this._isIPCMessageBelongController(message)) {
            return;
        }
        // Redirect results
        console.log('RESULTS', message);
    }


}
