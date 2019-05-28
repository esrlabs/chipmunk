import ServiceElectron, { IPCMessages as IPCElectronMessages, Subscription } from '../services/service.electron';
import Logger from '../tools/env.logger';
import * as fs from 'fs';
import ControllerStreamFileReader from './controller.stream.file.reader';
import { RGSearchWrapper } from './controller.stream.search.rg';
import State from './controller.stream.search.state';
import { IMapItem } from './controller.stream.search.map';
import Transform from './controller.stream.search.pipe.transform';
import NullWritableStream from '../classes/stream.writable.null';

export interface IRange {
    start: number;
    end: number;
}

export interface IRangeMapItem {
    rows: IRange;
    bytes: IRange;
}

export default class ControllerStreamSearch {

    private _guid: string;
    private _logger: Logger;
    private _streamFile: string;
    private _searchFile: string;
    private _searchReader: ControllerStreamFileReader | undefined;
    private _subscriptions: { [key: string ]: Subscription | undefined } = { };
    private _state: State;

    constructor(guid: string, streamFile: string, searchFile: string) {
        this._guid = guid;
        this._streamFile = streamFile;
        this._searchFile = searchFile;
        this._logger = new Logger(`ControllerStreamSearch: ${this._guid}`);
        this._state = new State(this._guid);
        this._ipc_onSearchRequest = this._ipc_onSearchRequest.bind(this);
        this._ipc_onSearchChunkRequested = this._ipc_onSearchChunkRequested.bind(this);
        ServiceElectron.IPC.subscribe(IPCElectronMessages.SearchRequest, this._ipc_onSearchRequest).then((subscription: Subscription) => {
            this._subscriptions.searchRequest = subscription;
        }).catch((error: Error) => {
            this._logger.warn(`Fail to subscribe to render event "SearchRequest" due error: ${error.message}. This is not blocked error, loading will be continued.`);
        });
        ServiceElectron.IPC.subscribe(IPCElectronMessages.SearchChunk, this._ipc_onSearchChunkRequested).then((subscription: Subscription) => {
            this._subscriptions.SearchChunk = subscription;
        }).catch((error: Error) => {
            this._logger.warn(`Fail to subscribe to render event "StreamChunk" due error: ${error.message}. This is not blocked error, loading will be continued.`);
        });
    }

    public destroy() {
        // TODO: check is rg works or results mapped. And force to close it
        if (this._searchReader !== undefined) {
            this._searchReader.destroy();
        }
        // Unsubscribe IPC messages / events
        Object.keys(this._subscriptions).forEach((key: string) => {
            (this._subscriptions as any)[key].destroy();
        });
    }

    private _search(requests: RegExp[], searchRequestId: string): Promise<number> {
        return new Promise((resolve, reject) => {
            const rg: RGSearchWrapper = new RGSearchWrapper(this._streamFile, this._searchFile);
            rg.search(requests).then(() => {
                this._generateFileMap(this._searchFile).then(() => {
                    resolve(this._state.map.getRowsCount());
                }).catch((writeError: Error) => {
                    reject(writeError);
                });
            }).catch((searchError: Error) => {
                reject(searchError);
            });
        });
    }

    private _generateFileMap(file: string): Promise<void> {
        return new Promise((resolve, reject) => {
            // Drop map
            this._state.map.drop();
            // Create reader
            const reader: fs.ReadStream = fs.createReadStream(file);
            // Create writer
            const writer: NullWritableStream = new NullWritableStream();
            // Create transformer
            const transform: Transform = new Transform({}, this._guid, this._state);
            // Listenn end of reading
            reader.once('end', () => {
                resolve();
            });
            // Listen error on reading
            reader.once('error', (error: Error) => {
                reject(new Error(this._logger.error(`Fail to read file due error: ${error.message}`)));
            });
            // Execute operation
            reader.pipe(transform).pipe(writer, { end: false });
        });
    }

    private _ipc_onSearchRequest(message: any, response: (instance: any) => any) {
        const done = (found: number | undefined, error?: string) => {
            // Send response
            response(new IPCElectronMessages.SearchRequestResults({
                streamId: message.streamId,
                requestId: message.requestId,
                error: error,
                results: {},
                matches: [],
                found: found === undefined ? 0 : found,
                duration: Date.now() - started,
            }));
            /*
            // Notify client
            ServiceElectron.IPC.send(new IPCElectronMessages.SearchRequestFinished({
                streamId: message.streamId,
                requestId: message.requestId,
                error: error,
                duration: Date.now() - started,
            }));
            */
        };
        // Check target stream
        if (this._guid !== message.streamId) {
            return;
        }
        // Fix time of starting
        const started: number = Date.now();
        // Destroy reader
        if (this._searchReader !== undefined) {
            this._searchReader.destroy();
        }
        // Drop results file
        this._dropSearchData().then(() => {
            if (message.requests.length === 0) {
                // Only dropping results
                return done(0);
            }
            // Create reader
            this._searchReader = new ControllerStreamFileReader(this._guid, this._searchFile);
            // Create regexps
            const requests: RegExp[] = message.requests.map((regInfo: IPCElectronMessages.IRegExpStr) => {
                return new RegExp(regInfo.source, regInfo.flags);
            });
            // Start searching
            this._search(requests, message.requestId).then((found: number) => {
                // Nothing to do with full results, because everything was sent during search
                done(found);
            }).catch((error: Error) => {
                done(undefined, error.message);
            });
        }).catch((error: Error) => {
            done(undefined, error.message);
        });
    }

    private _dropSearchData(): Promise<void> {
        return new Promise((resolve, reject) => {
            // Check and drop file
            if (!fs.existsSync(this._searchFile)) {
                return resolve();
            }
            fs.unlink(this._searchFile, (error: NodeJS.ErrnoException | null) => {
                if (error) {
                    return reject(this._logger.error(`Fail to remove search file due error: ${error.message}`));
                }
                resolve();
            });
        });
    }

    private _ipc_onSearchChunkRequested(_message: IPCElectronMessages.TMessage, response: (isntance: IPCElectronMessages.TMessage) => any) {
        const message: IPCElectronMessages.SearchChunk = _message as IPCElectronMessages.SearchChunk;
        if (message.guid !== this._guid) {
            return;
        }
        // Get bytes range (convert rows range to bytes range)
        const range: IMapItem | Error = this._state.map.getBytesRange({
            from: message.start,
            to: message.end,
        });
        if (range instanceof Error) {
            return response(new IPCElectronMessages.SearchChunk({
                guid: this._guid,
                start: -1,
                end: -1,
                rows: this._state.map.getRowsCount(),
                length: this._state.map.getByteLength(),
                error: this._logger.error(`Fail to process SearchChunk request due error: ${range.message}`),
            }));
        }
        if (this._searchReader === undefined) {
            return response(new IPCElectronMessages.SearchChunk({
                guid: this._guid,
                start: -1,
                end: -1,
                rows: this._state.map.getRowsCount(),
                length: this._state.map.getByteLength(),
                error: this._logger.error(`Fail to process SearchChunk request due error: reader of results aren't ready.`),
            }));
        }
        // Reading chunk
        this._searchReader.read(range.bytes.from, range.bytes.to).then((output: string) => {
            response(new IPCElectronMessages.SearchChunk({
                guid: this._guid,
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

}
