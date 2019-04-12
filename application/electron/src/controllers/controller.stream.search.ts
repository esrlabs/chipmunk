import { Fragment, IResults } from './controller.stream.search.engine';
import ServiceElectron, { IPCMessages as IPCElectronMessages, Subscription } from '../services/service.electron';
import Logger from '../tools/env.logger';
import * as fs from 'fs';
import ControllerStreamFileReader from './controller.stream.file.reader';

export { IResults };

export interface IRange {
    start: number;
    end: number;
}

export interface IRangeMapItem {
    rows: IRange;
    bytes: IRange;
}

const Settings = {
    notificationDelayWritingStream: 150,
    maxPostponedNotificationMessages: 100,    // How many IPC messages to render (client) should be postponed via timer
};

export default class ControllerStreamSearch {

    private _guid: string;
    private _logger: Logger;
    private _streamFile: string;
    private _searchFile: string;
    private _searchWriter: fs.WriteStream | undefined;
    private _searchReader: ControllerStreamFileReader | undefined;
    private _subscriptions: { [key: string ]: Subscription | undefined } = { };
    private _attempts: number = 0;
    private _timer: any;
    private _rows: {
        last: number,
        ranges: IRangeMapItem[],
        length: number,
        bytesWritten: number,
    } = {
        last: 0,
        ranges: [],
        length: 0,
        bytesWritten: 0,
    };

    constructor(guid: string, streamFile: string, searchFile: string) {
        this._guid = guid;
        this._streamFile = streamFile;
        this._searchFile = searchFile;
        this._logger = new Logger(`ControllerStreamSearch: ${this._guid}`);
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
        if (this._searchWriter !== undefined) {
            this._searchWriter.close();
            this._searchWriter.removeAllListeners();
        }
        if (this._searchReader !== undefined) {
            this._searchReader.destroy();
        }
        // Unsubscribe IPC messages / events
        Object.keys(this._subscriptions).forEach((key: string) => {
            (this._subscriptions as any)[key].destroy();
        });
    }

    private _search(requests: RegExp[], searchRequestId: string): Promise<IResults> {
        return new Promise((resolve, reject) => {
            const close = () => {
                if (streamReader === undefined) {
                    return;
                }
                streamReader.close();
                streamReader.removeAllListeners();
                streamReader = undefined;
            };
            const done = () => {
                close();
                if (restFromChunkEnd !== '') {
                    const res: IResults | Error = this._findInChunk(requests, restFromChunkEnd, result);
                    if (res instanceof Error) {
                        return reject(new Error(this._logger.warn(`Cannot continue search due error: ${res.message}`)));
                    }
                }
                resolve(result);
            };
            let streamReader: fs.ReadStream | undefined = fs.createReadStream(this._streamFile, { encoding: 'utf8' });
            // To store rest of each chunk
            let restFromChunkEnd = '';
            // To store write chunks
            const writeState: {
                pending: number,
                done: number,
            } = {
                pending: 0,
                done: 0,
            };
            // Storage of results
            const result: IResults = {
                found: 0,
                regs: {},
                str: '',
                rows: 0,
            };
            // Offset in file. We need it to correctly calculate numbers of rows
            // Get file info
            const stat: fs.Stats = fs.statSync(this._streamFile);
            // Create stream to read a target file
            streamReader.on('data', (chunk: string) => {
                // Append to the beggining of chunk rest part from previous
                chunk = `${restFromChunkEnd}${chunk}`;
                // Remove last row in chunk because it could be not finished
                const rows: string[] = chunk.split(/\r?\n|\r/gi);
                restFromChunkEnd = rows[rows.length - 1];
                rows.splice(rows.length - 1, 1);
                chunk = rows.join('\n');
                // Start search
                const res: IResults | Error = this._findInChunk(requests, chunk, result);
                if (res instanceof Error) {
                    done();
                    return reject(new Error(this._logger.warn(`Cannot continue search due error: ${res.message}`)));
                }
                // Write data to search results file
                writeState.pending += 1;
                this._writeToSearchFile(res.str, res.rows).then(() => {
                    writeState.done += 1;
                    // Check: is stream already finished
                    if (writeState.pending === writeState.done && streamReader !== undefined && streamReader.bytesRead === stat.size) {
                        // Whole file is read. If stream still is available - event "end" wasn't triggered.
                        done();
                    }
                }).catch((writeError: Error) => {
                    close();
                    reject(new Error(this._logger.error(`Fail to write search results due error: ${writeError.message}`)));
                });
                // Send message about middle results
                this._sendMiddleResults(searchRequestId, res);
            });
            streamReader.on('end', () => {
                // done();
            });
        });
    }

    private _findInChunk(requests: RegExp[], chunk: string, results: IResults): Error | IResults {
        const fragment: Fragment = new Fragment(1000000, chunk);
        const res: IResults | Error = fragment.find(requests);
        if (res instanceof Error) {
            return res;
        }
        results.found += res.found;
        results.rows += res.rows;
        Object.keys(res.regs).forEach((reg: string) => {
            const index: number = parseInt(reg, 10);
            if (results.regs[index] === undefined) {
                results.regs[index] = res.regs[index];
            } else {
                results.regs[index].push(...res.regs[index]);
            }
        });
        return res;
    }

    private _ipc_onSearchRequest(message: any, response: (instance: any) => any) {
        const done = (error?: string) => {
            // Destroy stream writer
            if (this._searchWriter !== undefined) {
                this._rows.length = this._rows.bytesWritten;
                this._searchWriter.close();
                this._searchWriter.removeAllListeners();
            }
            this._searchWriter = undefined;
            // Notify client
            ServiceElectron.IPC.send(new IPCElectronMessages.SearchRequestFinished({
                streamId: message.streamId,
                requestId: message.requestId,
                error: error,
                duration: Date.now() - started,
            }));
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
            // Create writer stream
            this._searchWriter = fs.createWriteStream(this._searchFile);
            // Create reader
            this._searchReader = new ControllerStreamFileReader(this._guid, this._searchFile);
            // Notify render: search is started
            ServiceElectron.IPC.send(new IPCElectronMessages.SearchRequestStarted({
                streamId: message.streamId,
                requestId: message.requestId,
            }));
            // Create regexps
            const requests: RegExp[] = message.requests.map((regInfo: IPCElectronMessages.IRegExpStr) => {
                return new RegExp(regInfo.source, regInfo.flags);
            });
            // Start searching
            this._search(requests, message.requestId).then((fullResults: IResults) => {
                // Nothing to do with full results, because everything was sent during search
                done();
            }).catch((error: Error) => {
                done(error.message);
            });
        }).catch((error: Error) => {
            done(error.message);
        });
    }

    private _sendMiddleResults(searchRequestId: string, middleResults: IResults) {
        // Send to render "middle" results
        ServiceElectron.IPC.send(new IPCElectronMessages.SearchRequestResults({
            streamId: this._guid,
            requestId: searchRequestId,
            results: middleResults.regs,
        }));
    }

    private _dropSearchData(): Promise<void> {
        return new Promise((resolve, reject) => {
            // Drop map
            this._rows.last = 0;
            this._rows.ranges = [];
            this._rows.bytesWritten = 0;
            // Check and drop file
            if (!fs.existsSync(this._searchFile)) {
                return resolve();
            }
            fs.unlink(this._searchFile, (error: NodeJS.ErrnoException) => {
                if (error) {
                    return reject(this._logger.error(`Fail to remove search file due error: ${error.message}`));
                }
                resolve();
            });
        });
    }

    private _writeToSearchFile(chunk: string, rows: number): Promise<void> {
        return new Promise((resolve, reject) => {
            if (this._searchWriter === undefined) {
                return reject(`Search result writer stream isn't created.`);
            }
            // Information about added frame
            const frame = { from: this._rows.last, to: (this._rows.last + rows - 1) };
            // Increase rows count
            this._rows.last += rows;
            // Store cursor position
            const cursor = {
                from: this._rows.bytesWritten,
                to: this._rows.bytesWritten + Buffer.byteLength(chunk, 'utf8') - 1,
            };
            // Increase bytes written value
            this._rows.bytesWritten += Buffer.byteLength(chunk, 'utf8');
            // Write data into session storage file
            this._searchWriter.write(chunk, 'utf8', (writeError: Error | null | undefined) => {
                if (writeError) {
                    return reject(new Error(this._logger.error(`Fail to write data into search results file due error: ${writeError.message}`)));
                }
                if (this._searchWriter === undefined) {
                    return;
                }
                // Store indexes after chuck is written
                this._rows.ranges.push({
                    bytes: { start: cursor.from, end: cursor.to },
                    rows: { start: frame.from, end: frame.to },
                });
                // Resolve in anyway, because writing was succesful
                resolve();
                // Drop previous timer
                clearTimeout(this._timer);
                // Set new timer for notification message
                if (this._attempts < Settings.maxPostponedNotificationMessages) {
                    this._attempts += 1;
                    this._timer = setTimeout(() => {
                        this._notifyRenderAboutresults(chunk, frame.from, frame.to).catch((sendingError: Error) => {
                            this._logger.error(`Fail to send search stream data to render due error: ${sendingError.message}`);
                        });
                    }, Settings.notificationDelayWritingStream);
                } else {
                    this._attempts = 0;
                    this._notifyRenderAboutresults(chunk, frame.from, frame.to).catch((sendingError: Error) => {
                        this._logger.error(`Fail to send search stream data to render due error: ${sendingError.message}`);
                    });
                }
            });
        });
    }

    private _notifyRenderAboutresults(complete: string, from: number, to: number): Promise<void> {
        return new Promise((resolve) => {
            this._sendUpdateSearchStreamData(complete, from, to).then(() => {
                resolve();
            }).catch((errorIPC: Error) => {
                this._logger.warn(`Fail send data from stream (${this._guid}) to render process due error: ${errorIPC.message}`);
            });
        });
    }

    private _sendUpdateSearchStreamData(complete?: string, from?: number, to?: number): Promise<void> {
        return ServiceElectron.IPC.send(new IPCElectronMessages.SearchStreamUpdated({
            guid: this._guid,
            length: this._rows.length,
            rowsCount: this._rows.last,
            addedRowsData: complete === undefined ? '' : complete,
            addedFrom: from === undefined ? -1 : from,
            addedTo: to === undefined ? -1 : to,
        }));
    }

    private _ipc_onSearchChunkRequested(_message: IPCElectronMessages.TMessage, response: (isntance: IPCElectronMessages.TMessage) => any) {
        const message: IPCElectronMessages.SearchChunk = _message as IPCElectronMessages.SearchChunk;
        if (message.guid !== this._guid) {
            return;
        }
        // Get bytes range (convert rows range to bytes range)
        const range: IRangeMapItem | Error = this._getBytesRange({
            start: message.start,
            end: message.end,
        });
        if (range instanceof Error) {
            return response(new IPCElectronMessages.SearchChunk({
                guid: this._guid,
                start: -1,
                end: -1,
                rows: this._rows.last + 1,
                length: this._rows.length,
                error: this._logger.error(`Fail to process SearchChunk request due error: ${range.message}`),
            }));
        }
        if (this._searchReader === undefined) {
            return response(new IPCElectronMessages.SearchChunk({
                guid: this._guid,
                start: -1,
                end: -1,
                rows: this._rows.last + 1,
                length: this._rows.length,
                error: this._logger.error(`Fail to process SearchChunk request due error: reader of results aren't ready.`),
            }));
        }
        // Reading chunk
        this._searchReader.read(range.bytes.start, range.bytes.end).then((output: string) => {
            response(new IPCElectronMessages.SearchChunk({
                guid: this._guid,
                start: range.rows.start,
                end: range.rows.end,
                data: output,
                rows: this._rows.last,
                length: this._rows.length,
            }));
        }).catch((readError: Error) => {
            this._logger.error(`Fail to read data from storage file due error: ${readError.message}`);
        });
    }

    private _getBytesRange(requestedRows: IRange): IRangeMapItem | Error {
        const bytes: IRange = { start: -1, end: -1 };
        const rows: IRange = { start: -1, end: -1 };
        for (let i = 0, max = this._rows.ranges.length - 1; i <= max; i += 1) {
            const range: IRangeMapItem = this._rows.ranges[i];
            if (bytes.start === -1 && requestedRows.start <= range.rows.start) {
                if (i > 0) {
                    bytes.start = this._rows.ranges[i - 1].bytes.start;
                    rows.start = this._rows.ranges[i - 1].rows.start;
                } else {
                    bytes.start = range.bytes.start;
                    rows.start = range.rows.start;
                }
            }
            if (bytes.end === -1 && requestedRows.end <= range.rows.end) {
                if (i < this._rows.ranges.length - 1) {
                    bytes.end = this._rows.ranges[i].bytes.end;
                    rows.end = this._rows.ranges[i].rows.end;
                } else {
                    bytes.end = range.bytes.end;
                    rows.end = range.rows.end;
                }
            }
            if (bytes.start !== -1 && bytes.end !== -1) {
                break;
            }
        }
        if (bytes.end === -1 || bytes.start === -1) {
            return new Error(`Fail to calculate bytes range with rows range: (${requestedRows.start} - ${requestedRows.end}).`);
        }
        return { bytes: bytes, rows: rows };
    }

}
