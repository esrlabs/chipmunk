import ServiceElectron, { IPCMessages as IPCElectronMessages, Subscription } from '../../services/service.electron';
import Logger from '../../tools/env.logger';
import * as fs from 'fs';
import ControllerStreamFileReader from '../stream.main/file.reader';
import State from './state';
import { EventsHub } from '../stream.common/events';
import { IMapItem } from './file.map';
import { SearchEngine, IMapData, IMapChunkEvent } from './engine/controller';
import * as Tools from '../../tools/index';

export interface IRange {
    from: number;
    to: number;
}

export interface IRangeMapItem {
    rows: IRange;
    bytes: IRange;
}

const CSettings = {
    delayOnAppend: 250, // ms, Delay for sending notifications about stream's update to render (client) via IPC, when stream is blocked
};

export default class ControllerStreamSearch {

    private _logger: Logger;
    private _reader: ControllerStreamFileReader;
    private _subscriptions: { [key: string ]: Subscription | undefined } = { };
    private _state: State;
    private _searching: SearchEngine;
    private _events: EventsHub;
    private _requests: RegExp[] = [];
    private _pending: {
        bytes: IRange,
        timer: any,
    } = {
        bytes: { from: -1, to: -1 },
        timer: -1,
    };

    constructor(guid: string, streamFile: string, searchFile: string, streamState: EventsHub) {
        this._events = streamState;
        // Create controllers
        this._state = new State(guid, streamFile, searchFile);
        this._logger = new Logger(`ControllerStreamSearch: ${this._state.getGuid()}`);
        this._searching = new SearchEngine(this._state);
        this._reader = new ControllerStreamFileReader(this._state.getGuid(), this._state.getSearchFile());
        // Listen map update event
        this._searching.on(SearchEngine.Events.onMapUpdated, this._onMapUpdated.bind(this));
        // Listen stream update event
        this._subscriptions.onStreamBytesMapUpdated = this._events.getSubject().onStreamBytesMapUpdated.subscribe(this._stream_onUpdate.bind(this));
        // Listen IPC messages
        ServiceElectron.IPC.subscribe(IPCElectronMessages.SearchRequest, this._ipc_onSearchRequest.bind(this)).then((subscription: Subscription) => {
            this._subscriptions.SearchRequest = subscription;
        }).catch((error: Error) => {
            this._logger.warn(`Fail to subscribe to render event "SearchRequest" due error: ${error.message}. This is not blocked error, loading will be continued.`);
        });
        ServiceElectron.IPC.subscribe(IPCElectronMessages.SearchRequestCancelRequest, this._ipc_onSearchRequestCancelRequest.bind(this)).then((subscription: Subscription) => {
            this._subscriptions.SearchRequestCancelRequest = subscription;
        }).catch((error: Error) => {
            this._logger.warn(`Fail to subscribe to render event "SearchRequestCancelRequest" due error: ${error.message}. This is not blocked error, loading will be continued.`);
        });
        ServiceElectron.IPC.subscribe(IPCElectronMessages.SearchChunk, this._ipc_onSearchChunkRequested.bind(this)).then((subscription: Subscription) => {
            this._subscriptions.SearchChunk = subscription;
        }).catch((error: Error) => {
            this._logger.warn(`Fail to subscribe to render event "StreamChunk" due error: ${error.message}. This is not blocked error, loading will be continued.`);
        });
    }

    public destroy(): Promise<void> {
        return new Promise((resolve, reject) => {
            // Unsubscribe IPC messages / events
            Object.keys(this._subscriptions).forEach((key: string) => {
                (this._subscriptions as any)[key].destroy();
            });
            // Drop listeners
            this._searching.removeAllListeners();
            // Clear results file
            this._clear().catch((error: Error) => {
                this._logger.error(`Error while killing: ${error.message}`);
            }).finally(() => {
                // Kill executor
                this._searching.destroy();
                // Kill reader
                this._reader.destroy();
                // Done
                resolve();
            });
        });
    }

    public reset(): Promise<void> {
        return new Promise((resolve, reject) => {
            // Clear search file
            this._clear().then(() => {
                // Create file
                fs.open(this._state.getSearchFile(), 'w', (createFileError: NodeJS.ErrnoException | null, fd: number) => {
                    if (createFileError) {
                        return reject(createFileError);
                    }
                    fs.close(fd, (closeFileError: NodeJS.ErrnoException | null) => {
                        if (closeFileError) {
                            return reject(closeFileError);
                        }
                        // Notification
                        this._state.postman.notification(true);
                        resolve();
                    });
                });
            }).catch((clearErr: Error) => {
                reject(clearErr);
            });
        });
    }

    private _append(updated?: IRange): void {
        clearTimeout(this._pending.timer);
        if (this._requests.length === 0) {
            return;
        }
        if (updated !== undefined) {
            if (this._pending.bytes.from === -1 || this._pending.bytes.from > updated.from) {
                this._pending.bytes.from = updated.from;
            }
            if (this._pending.bytes.to === -1 || this._pending.bytes.to < updated.to) {
                this._pending.bytes.to = updated.to;
            }
        }
        if (this._searching.isWorking()) {
            this._pending.timer = setTimeout(this._append.bind(this), CSettings.delayOnAppend);
            return;
        }
        const bytes: IRange = { from: this._pending.bytes.from, to: this._pending.bytes.to };
        this._pending.bytes = { from: -1, to: -1 };
        this._search(this._requests, Tools.guid(), bytes.from, bytes.to).catch((searchErr: Error) => {
            this._logger.warn(`Fail to append search results (range: ${bytes.from} - ${bytes.to}) due error: ${searchErr.message}`);
        });
    }

    private _search(requests: RegExp[], id: string, from?: number, to?: number): Promise<number> {
        return new Promise((resolve, reject) => {
            const task = this._searching.search(requests, from, to);
            if (task instanceof Error) {
                this._logger.error(`Fail to create task for search due error: ${task.message}`);
                return reject(task);
            }
            task.then((map: IMapItem[]) => {
                this._inspect(requests);
                this._requests = requests;
                resolve(this._state.map.getRowsCount());
            }).catch((searchErr: Error) => {
                this._logger.error(`Fail to execute search due error: ${searchErr.message}`);
                reject(searchErr);
            });
        });
    }

    private _inspect(requests: RegExp[]) {
        // Start inspecting
        const inspecting = this._searching.inspect(requests);
        if (inspecting instanceof Error) {
            this._logger.warn(`Fail to start inspecting search results due error: ${inspecting.message}`);
            return;
        }
        inspecting.then((data: IMapData) => {
            // Notify render
            ServiceElectron.IPC.send(new IPCElectronMessages.SearchResultMap({
                streamId: this._state.getGuid(),
                append: false,
                map: data.map,
                stats: data.stats,
            })).catch((error: Error) => {
                this._logger.warn(`Fail send notification to render due error: ${error.message}`);
            });
        }).catch((execErr: Error) => {
            this._logger.warn(`Fail to make inspecting search results due error: ${execErr.message}`);
        });
    }

    private _clear(): Promise<void> {
        return new Promise((resolve, reject) => {
            // Cancel current task if exist
            this._searching.cancel();
            // Drop map
            this._state.map.drop();
            // Clear stored requests
            this._requests = [];
            // Check and drop file
            if (!fs.existsSync(this._state.getSearchFile())) {
                return resolve();
            }
            fs.unlink(this._state.getSearchFile(), (error: NodeJS.ErrnoException | null) => {
                if (error) {
                    return reject(this._logger.error(`Fail to remove search file due error: ${error.message}`));
                }
                // Drop reader
                this._reader.drop();
                resolve();
            });
        });
    }

    private _onMapUpdated(event: IMapChunkEvent) {
        // Add map
        this._state.map.add(event.map);
        // Notifications is here
        this._state.postman.notification(false);
    }

    private _ipc_onSearchRequest(message: IPCElectronMessages.TMessage, response: (instance: any) => any) {
        const request: IPCElectronMessages.SearchRequest = message as IPCElectronMessages.SearchRequest;
        // Store starting tile
        const started: number = Date.now();
        // Check target stream
        if (this._state.getGuid() !== request.streamId) {
            return;
        }
        // Check count of requests
        if (request.requests.length === 0) {
            return this._ipc_searchRequestResponse(response, {
                id: request.requestId,
                started: started,
                found: 0,
            });
        }
        // Clear results file
        this._clear().then(() => {
            // Create regexps
            const requests: RegExp[] = request.requests.map((regInfo: IPCElectronMessages.IRegExpStr) => {
                return new RegExp(regInfo.source, regInfo.flags);
            });
            this._search(requests, request.requestId).then((rows: number) => {
                // Responce with results
                this._ipc_searchRequestResponse(response, {
                    id: request.requestId,
                    started: started,
                    found: rows,
                });
            }).catch((searchErr: Error) => {
                return this._ipc_searchRequestResponse(response, {
                    id: request.requestId,
                    started: started,
                    error: searchErr.message,
                });
            });
        }).catch((droppingErr: Error) => {
            this._logger.error(`Fail drop search file due error: ${droppingErr.message}`);
            return this._ipc_searchRequestResponse(response, {
                id: request.requestId,
                started: started,
                error: droppingErr.message,
            });
        });
    }

    private _ipc_searchRequestResponse(response: (instance: any) => any, res: {
        id: string, started: number, found?: number, error?: string,
    }) {
        response(new IPCElectronMessages.SearchRequestResults({
            streamId: this._state.getGuid(),
            requestId: res.id,
            error: res.error,
            results: {},
            matches: [],
            found: res.found === undefined ? 0 : res.found,
            duration: Date.now() - res.started,
        }));
    }

    private _ipc_onSearchRequestCancelRequest(message: IPCElectronMessages.TMessage, response: (instance: any) => any) {
        const request: IPCElectronMessages.SearchRequestCancelRequest = message as IPCElectronMessages.SearchRequestCancelRequest;
        // Clear results file
        this._clear().then(() => {
            response(new IPCElectronMessages.SearchRequestCancelResponse({
                streamId: this._state.getGuid(),
                requestId: request.requestId,
            }));
        }).catch((error: Error) => {
            response(new IPCElectronMessages.SearchRequestCancelResponse({
                streamId: this._state.getGuid(),
                requestId: request.requestId,
                error: error.message,
            }));
        });
    }

    private _ipc_onSearchChunkRequested(_message: IPCElectronMessages.TMessage, response: (isntance: IPCElectronMessages.TMessage) => any) {
        const message: IPCElectronMessages.SearchChunk = _message as IPCElectronMessages.SearchChunk;
        if (message.guid !== this._state.getGuid()) {
            return;
        }
        // Get bytes range (convert rows range to bytes range)
        const range: IMapItem | Error = this._state.map.getBytesRange({
            from: message.start,
            to: message.end,
        });
        if (range instanceof Error) {
            return response(new IPCElectronMessages.SearchChunk({
                guid: this._state.getGuid(),
                start: -1,
                end: -1,
                rows: this._state.map.getRowsCount(),
                length: this._state.map.getByteLength(),
                error: this._logger.error(`Fail to process SearchChunk request due error: ${range.message}`),
            }));
        }
        // Reading chunk
        this._reader.read(range.bytes.from, range.bytes.to).then((output: string) => {
            response(new IPCElectronMessages.SearchChunk({
                guid: this._state.getGuid(),
                start: range.rows.from,
                end: range.rows.to,
                data: output,
                rows: this._state.map.getRowsCount(),
                length: this._state.map.getByteLength(),
            }));
        }).catch((readError: Error) => {
            this._logger.error(`Fail to read data from storage file due error: ${readError.message}`);
        });
    }

    private _stream_onUpdate(bytes: IRange) {
        this._append(bytes);
    }

}
