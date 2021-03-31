import { EventsHub } from '../stream.common/events';
import { IMapItem } from './file.map';
import { SearchEngine, IMapChunkEvent } from './engine/controller';
import { getSearchRegExp } from '../../../../common/functionlity/functions.search.requests';
import { IPCMessages as IPC, Subscription } from '../../services/service.electron';

import ServiceElectron from '../../services/service.electron';
import Logger from '../../tools/env.logger';
import ControllerStreamFileReader from '../stream.main/file.reader';
import ControllerStreamProcessor from '../stream.main/controller';
import State from './state';

import * as Tools from '../../tools/index';
import * as fs from 'fs';

export interface IRange {
    from: number;
    to: number;
}

export interface IRangeMapItem {
    rows: IRange;
    bytes: IRange;
}

export default class ControllerStreamSearch {

    private _logger: Logger;
    private _reader: ControllerStreamFileReader;
    private _subscriptions: { [key: string ]: Subscription | undefined } = { };
    private _state: State;
    private _searching: SearchEngine;
    private _events: EventsHub;
    private _processor: ControllerStreamProcessor;
    private _pending: {
        bytesReadTo: number,
    } = {
        bytesReadTo: 0,
    };

    constructor(guid: string, streamFile: string, searchFile: string, stream: ControllerStreamProcessor, streamState: EventsHub) {
        this._events = streamState;
        this._processor = stream;
        // Create controllers
        this._state = new State(guid, streamFile, searchFile);
        this._logger = new Logger(`ControllerStreamSearch: ${this._state.getGuid()}`);
        this._searching = new SearchEngine(this._state, stream);
        this._reader = new ControllerStreamFileReader(this._state.getGuid(), this._state.getSearchFile());
        // Listen map update event
        this._searching.on(SearchEngine.Events.onMapUpdated, this._onMapUpdated.bind(this));
        // Listen stream update event
        this._subscriptions.onStreamBytesMapUpdated = this._events.getSubject().onStreamBytesMapUpdated.subscribe(this._stream_onUpdate.bind(this));
        // Listen IPC messages
        ServiceElectron.IPC.subscribe(IPC.SearchRequest, this._ipc_onSearchRequest.bind(this)).then((subscription: Subscription) => {
            this._subscriptions.SearchRequest = subscription;
        }).catch((error: Error) => {
            this._logger.warn(`Fail to subscribe to render event "SearchRequest" due error: ${error.message}. This is not blocked error, loading will be continued.`);
        });
        ServiceElectron.IPC.subscribe(IPC.SearchChunk, this._ipc_onSearchChunkRequested.bind(this)).then((subscription: Subscription) => {
            this._subscriptions.SearchChunk = subscription;
        }).catch((error: Error) => {
            this._logger.warn(`Fail to subscribe to render event "StreamChunk" due error: ${error.message}. This is not blocked error, loading will be continued.`);
        });
        ServiceElectron.IPC.subscribe(IPC.SearchResultMapRequest, this._ipc_onSearchResultMapRequest.bind(this) as any).then((subscription: Subscription) => {
            this._subscriptions.SearchResultMapRequest = subscription;
        }).catch((error: Error) => {
            this._logger.warn(`Fail to subscribe to render event "SearchResultMapRequest" due error: ${error.message}. This is not blocked error, loading will be continued.`);
        });
        ServiceElectron.IPC.subscribe(IPC.SearchIndexAroundRequest, this._ipc_onSearchIndexAroundRequest.bind(this) as any).then((subscription: Subscription) => {
            this._subscriptions.SearchIndexAroundRequest = subscription;
        }).catch((error: Error) => {
            this._logger.warn(`Fail to subscribe to render event "SearchIndexAroundRequest" due error: ${error.message}. This is not blocked error, loading will be continued.`);
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
            // Drop search controller
            this._searching.drop().then(() => {
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
            }).catch((dropError: Error) => {
                reject(dropError);
            });
        });
    }

    private _append(updated?: IRange): void {
        if (!this._state.hasActiveRequests() || this._processor.getStreamSize() === 0) {
            this._pending.bytesReadTo = -1;
            return;
        }
        if (updated !== undefined && this._pending.bytesReadTo < updated.to) {
            this._pending.bytesReadTo = updated.to;
        }
        if (this._searching.isWorking()) {
            return;
        }
        this._search(Tools.guid(), this._pending.bytesReadTo).catch((searchErr: Error) => {
            this._logger.error(`Fail to append search results due error: ${searchErr.message}`);
        }).finally(() => {
            this._reappend();
        });
        this._pending.bytesReadTo = -1;
    }

    private _reappend() {
        if (this._pending.bytesReadTo === -1) {
            return;
        }
        this._append();
    }

    private _search(id: string, to?: number): Promise<number> {
        return new Promise((resolve, reject) => {
            const task = this._searching.search(this._state.getRequests(), to);
            if (task instanceof Error) {
                this._logger.error(`Fail to create task for search due error: ${task.message}`);
                return reject(task);
            }
            task.then((map: IMapItem[]) => {
                this._inspect();
                this._state.postman.notification().SearchUpdated();
                resolve(this._state.map.getRowsCount());
            }).catch((searchErr: Error) => {
                this._logger.error(`Fail to execute search due error: ${searchErr.message}`);
                reject(searchErr);
            });
        });
    }

    private _inspect() {
        if (!this._state.hasActiveRequests() || this._processor.getStreamSize() === 0) {
            return;
        }
        // Start inspecting
        const inspecting = this._searching.inspect(this._state.getRequests());
        if (inspecting instanceof Error) {
            this._logger.warn(`Fail to start inspecting search results due error: ${inspecting.message}`);
            return;
        }
        inspecting.then(() => {
            // Notify render
            this._state.postman.notification().SearchResultMap();
        }).catch((execErr: Error) => {
            this._logger.warn(`Fail to make inspecting search results due error: ${execErr.message}`);
        }).finally(() => {
            this._reappend();
        });
    }

    private _clear(): Promise<void> {
        return new Promise((resolve, reject) => {
            // Cancel current task if exist
            this._searching.cancel().finally(() => {
                // Drop map
                this._state.map.drop();
                // Drop postman
                this._state.postman.drop();
                // Close reader
                this._reader.drop();
                // Check and drop file
                fs.open(this._state.getSearchFile(), 'r', (err: NodeJS.ErrnoException | null, fd: number) => {
                    if (err) {
                        if (err.code === 'ENOENT') {
                            return resolve();
                        }
                        return reject(new Error(this._logger.error(`Unexpected error with file "${this._state.getSearchFile()}": ${err.code}:: ${err.message}`)));
                    }
                    fs.close(fd, (closeFileError: NodeJS.ErrnoException | null) => {
                        if (closeFileError) {
                            return reject(closeFileError);
                        }
                        fs.unlink(this._state.getSearchFile(), (error: NodeJS.ErrnoException | null) => {
                            if (error) {
                                if (error.code === 'ENOENT') {
                                    return resolve();
                                } else {
                                    return reject(new Error(this._logger.error(`Fail to remove search file due error: ${error.message}`)));
                                }
                            }
                            resolve();
                        });
                    });
                });
            });
        });
    }

    private _onMapUpdated(event: IMapChunkEvent) {
        // Add map
        this._state.map.add(event.map);
        // Notifications is here
        this._state.postman.notification(false);
    }

    private _ipc_onSearchRequest(message: IPC.TMessage, response: (instance: any) => any) {
        const request: IPC.SearchRequest = message as IPC.SearchRequest;
        // Store starting tile
        const started: number = Date.now();
        // Check target stream
        if (this._state.getGuid() !== request.session) {
            return;
        }
        // Clean requests
        request.requests = request.requests.filter((filter: IPC.ISearchExpression) => {
            if (filter.request === '') {
                this._logger.warn(`From client was gotten empty search request. Session: ${request.session}. Request will be ignored.`);
            }
            return filter.request !== '';
        });
        // Check count of requests
        if (request.requests.length === 0) {
            // Clean if necessary
            if (this._state.hasActiveRequests()) {
                this._clear().then(() => {
                    this._ipc_searchRequestResponse(response, {
                        id: request.session,
                        started: started,
                        found: 0,
                    });
                }).catch((error: Error) => {
                    this._logger.error(`Fail to clean search request due error: ${error.message}`);
                    this._ipc_searchRequestResponse(response, {
                        id: request.session,
                        started: started,
                        found: 0,
                        error: error.message,
                    });
                });
                // Drop requests
                this._state.setRequests([]);
            } else {
                this._ipc_searchRequestResponse(response, {
                    id: request.session,
                    started: started,
                    found: 0,
                });
            }
            return;
        }
        // Clear results file
        this._clear().then(() => {
            // Save requests
            this._state.setRequests(request.requests.map((req: IPC.ISearchExpression) => {
                return getSearchRegExp(req.request, req.flags);
            }));
            // Check stream
            if (this._processor.getStreamSize() === 0) {
                // Stream file doesn't exist yet
                return this._ipc_searchRequestResponse(response, {
                    id: request.session,
                    started: started,
                    found: 0,
                });
            }
            this._search(request.session).then((rows: number) => {
                // Responce with results
                this._ipc_searchRequestResponse(response, {
                    id: request.session,
                    started: started,
                    found: rows,
                });
            }).catch((searchErr: Error) => {
                this._logger.error(`Fail to procceed search request due error: ${searchErr.message}`);
                return this._ipc_searchRequestResponse(response, {
                    id: request.session,
                    started: started,
                    error: searchErr.message,
                });
            });
        }).catch((droppingErr: Error) => {
            // Drop requests
            this._state.setRequests([]);
            this._logger.error(`Fail drop search file due error: ${droppingErr.message}`);
            return this._ipc_searchRequestResponse(response, {
                id: request.session,
                started: started,
                error: droppingErr.message,
            });
        });
    }

    private _ipc_searchRequestResponse(response: (instance: any) => any, res: {
        id: string, started: number, found?: number, error?: string,
    }) {
        response(new IPC.SearchRequestResults({
            streamId: this._state.getGuid(),
            requestId: res.id,
            error: res.error,
            results: {},
            matches: [],
            found: res.found === undefined ? 0 : res.found,
            duration: Date.now() - res.started,
        }));
    }

    private _ipc_onSearchChunkRequested(_message: IPC.TMessage, response: (isntance: IPC.TMessage) => any) {
        const message: IPC.SearchChunk = _message as IPC.SearchChunk;
        if (message.guid !== this._state.getGuid()) {
            return;
        }
        // Check current state
        if (!this._state.hasActiveRequests()) {
            return response(new IPC.SearchChunk({
                guid: this._state.getGuid(),
                start: 0,
                end: 0,
                rows: 0,
                length: 0,
            }));
        }
        // Get bytes range (convert rows range to bytes range)
        const range: IMapItem | Error = this._state.map.getBytesRange({
            from: message.start,
            to: message.end,
        });
        if (range instanceof Error) {
            return response(new IPC.SearchChunk({
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
            response(new IPC.SearchChunk({
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

    private _ipc_onSearchResultMapRequest(message: IPC.SearchResultMapRequest, response: (isntance: IPC.SearchResultMapResponse) => any) {
        if (message.streamId !== this._state.getGuid()) {
            return;
        }
        response(new IPC.SearchResultMapResponse({
            streamId: this._state.getGuid(),
            scaled: this._searching.getSearchResultMap(message.scale, message.details, message.range),
        }));
    }

    private _ipc_onSearchIndexAroundRequest(message: IPC.SearchIndexAroundRequest, response: (isntance: IPC.SearchIndexAroundResponse) => any) {
        if (message.session !== this._state.getGuid()) {
            return;
        }
        const around = this._searching.getIndexAround(message.position);
        response(new IPC.SearchIndexAroundResponse({
            after: around.after,
            before: around.before,
        }));
    }

    private _stream_onUpdate(map: IMapItem) {
        this._append(map.bytes);
    }

}
