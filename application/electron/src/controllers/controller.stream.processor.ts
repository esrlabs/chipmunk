import * as fs from 'fs';
import Logger from '../tools/env.logger';
import ServiceElectron, { IPCMessages as IPCElectronMessages, Subscription } from '../services/service.electron';
import ServicePlugins from '../services/service.plugins';
import ControllerIPCPlugin, { IPCMessages as IPCPluginMessages} from './controller.plugin.process.ipc';
import ControllerStreamFileReader from './controller.stream.file.reader';
import PipesState from './controller.stream.processor.pipes.state';
import Transform from './controller.stream.processor.transform';

export interface IPluginInfo {
    id: number;
    token: string;
}

export interface IRange {
    start: number;
    end: number;
}

export interface IRangeMapItem {
    rows: IRange;
    bytes: IRange;
}

export interface IStreamStateInfo {
    started: number;
    memoryUsed: number;
}

export interface IAddIndexesResults {
    output: string;
    from: number;
    to: number;
}

const REGEXPS = {
    CARRETS: /[\r?\n|\r]/gi,
};

const MARKERS = {
    PLUGIN: '\u0003',
    NUMBER: '\u0002',
};

const Settings = {
    notificationDelayOnBlockedStream: 150,    // ms, Delay for sending notifications about stream's update to render (client) via IPC, when stream is blocked
    notificationDelayOnUnblockedStream: 50,   // ms, Delay for sending notifications about stream's update to render (client) via IPC, when stream is unblocked
    maxPostponedNotificationMessages: 100,    // How many IPC messages to render (client) should be postponed via timer
};

export default class ControllerStreamProcessor {

    public static Events = {
        next: 'next',
    };
    private _logger: Logger;
    private _guid: string;
    private _file: string;
    private _stream: fs.WriteStream;
    private _reader: ControllerStreamFileReader;
    private _pluginRefs: Map<string, number> = new Map();
    private _pluginIPCSubscriptions: {
        state: Map<number, Subscription>,
        pipeStarted: Map<number, Subscription>,
        pipeFinished: Map<number, Subscription>,
    } = {
        state: new Map(),
        pipeStarted: new Map(),
        pipeFinished: new Map(),
    };
    private _state: Map<number, IStreamStateInfo> = new Map();
    private _rows: {
        last: number,
        ranges: IRangeMapItem[],
        bytesWritten: number,
        rest: string,
        lastPluginId: number,
    } = {
        last: 0,
        ranges: [],
        bytesWritten: 0,
        rest: '',
        lastPluginId: -1,
    };
    private _timer: any;
    private _attempts: number = 0;
    private _subscriptions: { [key: string ]: Subscription | undefined } = { };
    private _pipesState: PipesState;

    constructor(guid: string, file: string) {
        this._guid = guid;
        this._file = file;
        this._stream = fs.createWriteStream(this._file, { encoding: 'utf8' });
        this._reader = new ControllerStreamFileReader(this._guid, this._file);
        this._logger = new Logger(`ControllerStreamProcessor: ${this._guid}`);
        this._pipesState = new PipesState(this._guid);
        this._ipc_onStreamChunkRequested = this._ipc_onStreamChunkRequested.bind(this);
        ServiceElectron.IPC.subscribe(IPCElectronMessages.StreamChunk, this._ipc_onStreamChunkRequested).then((subscription: Subscription) => {
            this._subscriptions.StreamChunk = subscription;
        }).catch((error: Error) => {
            this._logger.warn(`Fail to subscribe to render event "StreamChunk" due error: ${error.message}. This is not blocked error, loading will be continued.`);
        });
    }

    public destroy() {
        this._stream.close();
        this._stream.removeAllListeners();
        this._reader.destroy();
        // Unsubscribe IPC messages / events
        Object.keys(this._subscriptions).forEach((key: string) => {
            (this._subscriptions as any)[key].destroy();
        });
    }

    public write(chunk: Buffer, pluginReference: string | undefined, pluginId?: number): Promise<void> {
        return new Promise((resolve, reject) => {
            let output: string;
            if (typeof chunk === 'string') {
                output = chunk;
            } else {
                output = chunk.toString('utf8');
            }
            // Binding ref with ID of plugin
            if (pluginReference !== undefined && this._bindPlugin(output, pluginReference) === true) {
                // This is binding message. No need to process it forward.
                return;
            }
            // Get plugin info
            const pluginInfo: IPluginInfo | Error = this._getPluginInfo(pluginReference, pluginId);
            if (pluginInfo instanceof Error) {
                return reject(new Error(`Fail to write data due error: ${pluginInfo.message}`));
            }
            // Remove double carret
            output = output.replace(REGEXPS.CARRETS, '\n').replace(/\n{2,}/g, '\n');
            // Check: is plugin changed or not
            if (this._rows.lastPluginId !== -1 && this._rows.lastPluginId !== pluginInfo.id) {
                // Source of data was changed.
                this._rows.rest = `${MARKERS.PLUGIN}${this._rows.lastPluginId}${MARKERS.PLUGIN}\n${this._rows.rest}`;
            }
            // Normalize (remove last row, which could be not finished)
            const rows: string[] = output.split(/\r?\n|\r/gi);
            const rest: string = rows[rows.length - 1];
            rows.splice(rows.length - 1, 1);
            // Join and add plugins signatures
            output = rows.join(`${MARKERS.PLUGIN}${pluginInfo.id}${MARKERS.PLUGIN}\n`);
            // Add signature for last item, because it's missed
            output = `${output}${MARKERS.PLUGIN}${pluginInfo.id}${MARKERS.PLUGIN}\n`;
            // Add rest from last chunk
            output = `${this._rows.rest}${output}`;
            // Update rest
            this._rows.rest = rest;
            // Information about added frame
            const frame = { from: this._rows.last, to: -1 };
            // Add rows indexes
            const addIndexesRes: IAddIndexesResults = this._addRowIndexes(output);
            output = addIndexesRes.output;
            // Set end of frame
            frame.to = this._rows.last - 1;
            // Get length
            const size: number = Buffer.byteLength(output, 'utf8');
            // Store cursor position
            const cursor = {
                from: this._rows.bytesWritten,
                to: this._rows.bytesWritten + size - 1,
            };
            // Increase bytes written value
            this._rows.bytesWritten += size;
            // Remember plugin id to break like in case it will change
            this._rows.lastPluginId = pluginInfo.id;
            // Write data into session storage file
            this._stream.write(output, (writeError: Error | null | undefined) => {
                if (writeError) {
                    return reject(new Error(this._logger.error(`Fail to write data into stream file due error: ${writeError.message}`)));
                }
                // Store indexes after chuck is written
                this._rows.ranges.push({
                    bytes: { start: cursor.from, end: cursor.to },
                    rows: { start: frame.from, end: frame.to },
                });
                // Send state information for pipes (if it's needed)
                this._pipesState.next(size);
                // Resolve in anyway, because writing was succesful
                resolve();
                // Notification of render (client) about stream's update
                const delay: number = Settings.notificationDelayOnUnblockedStream;
                // Drop previous timer
                clearTimeout(this._timer);
                // Set new timer for notification message
                if (this._attempts < Settings.maxPostponedNotificationMessages) {
                    this._attempts += 1;
                    this._timer = setTimeout(() => {
                        this._sendToRender(addIndexesRes.output, addIndexesRes.from, addIndexesRes.to).catch((sendingError: Error) => {
                            this._logger.error(`Fail to send stream data to render due error: ${sendingError.message}`);
                        });
                    }, delay);
                } else {
                    this._attempts = 0;
                    this._sendToRender(addIndexesRes.output, addIndexesRes.from, addIndexesRes.to).catch((sendingError: Error) => {
                        this._logger.error(`Fail to send stream data to render due error: ${sendingError.message}`);
                    });
                }
            });
        });
    }

    public addPipeSession(pipeId: string, size: number, name: string) {
        this._pipesState.add(pipeId, size, name);
    }

    public removePipeSession(pipeId: string) {
        this._pipesState.remove(pipeId);
    }

    private _addRowIndexes(str: string): IAddIndexesResults {
        const result: IAddIndexesResults = {
            output: '',
            from: this._rows.last,
            to: this._rows.last,
        };
        str = str.replace(REGEXPS.CARRETS, () => {
            const injection: string = `${(MARKERS.NUMBER + (this._rows.last++) + MARKERS.NUMBER)}\n`;
            result.to += 1;
            return injection;
        });
        result.output = str;
        return result;
    }

    private _getPluginInfo(pluginReference: string | undefined, id?: number): IPluginInfo | Error {
        // Attempt to find ID of plugin
        const pluginId: number | undefined = pluginReference === undefined ? id : this._pluginRefs.get(pluginReference);
        if (pluginId === undefined) {
            return { id: 1, token: '' };
            // return new Error(`Fail to find plugin ID. Chunk of data will not be forward.`);
        }
        // Get token
        const pluginToken: string | undefined = ServicePlugins.getPluginToken(pluginId);
        if (pluginToken === undefined) {
            return { id: 1, token: '' };
            // return new Error(`Fail to find plugin token by ID of plugin: id = "${pluginId}". Chunk of data will not be forward.`);
        }
        return { id: pluginId, token: pluginToken };
    }

    private _sendToRender(complete: string, from: number, to: number): Promise<void> {
        return new Promise((resolve) => {
            this._sendUpdateStreamData(complete, from, to).then(() => {
                resolve();
            }).catch((errorIPC: Error) => {
                this._logger.warn(`Fail send data from stream (${this._guid}) to render process due error: ${errorIPC.message}`);
            });
        });
    }

    private _bindPlugin(chunk: string, ref: string): boolean {
        if (this._pluginRefs.has(ref)) {
            // Plugin's connection is already bound
            return false;
        }
        if (chunk.search(/\[plugin:\d*\]/) === -1) {
            return false;
        }
        const id: number = parseInt(chunk.replace('[plugin:', '').replace(']', ''), 10);
        const token: string | undefined = ServicePlugins.getPluginToken(id);
        if (token === undefined) {
            this._logger.warn(`Fail to find plugin token by ID of plugin: id = "${id}". Attempt auth of plugin connection is failed.`);
            return false;
        }
        // Bind plugin ref with plugin ID
        this._pluginRefs.set(ref, id);
        this._logger.env(`Plugin #${id} (${ServicePlugins.getPluginName(id)}) bound with reference "${ref}".`);
        // Get IPC of plugin
        const IPC: ControllerIPCPlugin | undefined = ServicePlugins.getPluginIPC(token);
        if (IPC === undefined) {
            return true;
        }
        IPC.subscribe(IPCPluginMessages.SessionStreamState, this._onSessionState.bind(this, id)).then((subscription: Subscription) => {
            this._pluginIPCSubscriptions.state.set(id, subscription);
        });
        IPC.subscribe(IPCPluginMessages.SessionStreamPipeStarted, this._onSessionStreamPipeStarted.bind(this, id)).then((subscription: Subscription) => {
            this._pluginIPCSubscriptions.pipeStarted.set(id, subscription);
        });
        IPC.subscribe(IPCPluginMessages.SessionStreamPipeFinished, this._onSessionStreamPipeFinished.bind(this, id)).then((subscription: Subscription) => {
            this._pluginIPCSubscriptions.pipeFinished.set(id, subscription);
        });
        return true;
    }

    private _onSessionState(id: number, message: IPCPluginMessages.SessionStreamState) {
        if (message.stream !== this._guid) {
            return;
        }
        if (message.state === IPCPluginMessages.SessionStreamState.States.block) {
            this._state.set(id, {
                started: Date.now(),
                memoryUsed: process.memoryUsage().heapUsed / 1024 / 1024,
            });
        } else if (this._state.has(id)) {
            const stateInfo: IStreamStateInfo = this._state.get(id) as IStreamStateInfo;
            const memory = {
                used: process.memoryUsage().heapUsed / 1024 / 1024,
                total: process.memoryUsage().heapTotal / 1024 / 1024,
            };
            this._logger.env(`Session was closed by plugin #${id} in ${((Date.now() - stateInfo.started) / 1000).toFixed(2)}s. Memory: on start: ${stateInfo.memoryUsed.toFixed(2)}Mb; on end: ${memory.used.toFixed(2)}/${memory.used.toFixed(2)}Mb; diff: ${(memory.used - stateInfo.memoryUsed).toFixed(2)}Mb`);
            // Close "long chunk" by carret
            this.write(Buffer.from('\n'), undefined, id);
            this._sendUpdateStreamData();
            this._state.delete(id);
        } else {
            this._logger.warn(`Cannot close session for plugin ${id} because session wasn't started.`);
        }
    }

    private _onSessionStreamPipeStarted(id: number, message: IPCPluginMessages.SessionStreamPipeStarted) {
        if (message.streamId !== this._guid) {
            return;
        }
        this._pipesState.add(message.pipeId, message.size, message.name);
    }

    private _onSessionStreamPipeFinished(id: number, message: IPCPluginMessages.SessionStreamPipeFinished) {
        if (message.streamId !== this._guid) {
            return;
        }
        this._pipesState.remove(message.pipeId);
    }

    private _sendUpdateStreamData(complete?: string, from?: number, to?: number): Promise<void> {
        return ServiceElectron.IPC.send(new IPCElectronMessages.StreamUpdated({
            guid: this._guid,
            length: this._rows.bytesWritten,
            rowsCount: this._rows.last,
            addedRowsData: complete === undefined ? '' : complete,
            addedFrom: from === undefined ? -1 : from,
            addedTo: to === undefined ? -1 : to,
        }));
    }

    private _ipc_onStreamChunkRequested(_message: IPCElectronMessages.TMessage, response: (isntance: IPCElectronMessages.TMessage) => any) {
        const message: IPCElectronMessages.StreamChunk = _message as IPCElectronMessages.StreamChunk;
        if (message.guid !== this._guid) {
            return;
        }
        // Get bytes range (convert rows range to bytes range)
        const range: IRangeMapItem | Error = this._getBytesRange({
            start: message.start,
            end: message.end,
        });
        if (range instanceof Error) {
            return response(new IPCElectronMessages.StreamChunk({
                guid: this._guid,
                start: -1,
                end: -1,
                rows: this._rows.last + 1,
                length: this._rows.bytesWritten,
                error: this._logger.error(`Fail to process StreamChunk request due error: ${range.message}`),
            }));
        }
        // Reading chunk
        this._reader.read(range.bytes.start, range.bytes.end).then((output: string) => {
            response(new IPCElectronMessages.StreamChunk({
                guid: this._guid,
                start: range.rows.start,
                end: range.rows.end,
                data: output,
                rows: this._rows.last,
                length: this._rows.bytesWritten,
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
                    bytes.end = this._rows.ranges[i + 1].bytes.end;
                    rows.end = this._rows.ranges[i + 1].rows.end;
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
