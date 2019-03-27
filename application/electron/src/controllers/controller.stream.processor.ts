import * as fs from 'fs';
import Logger from '../../platform/node/src/env.logger';
import ServiceElectron, { IPCMessages as IPCElectronMessages, Subscription } from '../services/service.electron';
import ServicePlugins from '../services/service.plugins';
import ControllerIPCPlugin, { IPCMessages as IPCPluginMessages} from './controller.plugin.process.ipc';
import ControllerStreamFileReader from './controller.stream.file.reader';

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

const REGEXPS = {
    CARRETS: /[\r?\n|\r]/gi,
};

const MARKERS = {
    PLUGIN: '\u0003',
    NUMBER: '\u0002',
};

// TODO: add markers of line numbers here to make search faster

export default class ControllerStreamProcessor {

    public static Events = {
        next: 'next',
    };
    private _maxSizeOfChunkToBeSentWithUpdate: number = 1024 * 1024; // Bytes. Maximal size of chunk, which will be send to render with notification of stream update
    private _logger: Logger;
    private _guid: string;
    private _file: string;
    private _stream: fs.WriteStream;
    private _reader: ControllerStreamFileReader;
    private _lastSourceDataPluginId: number = -1;
    private _pluginRefs: Map<string, number> = new Map();
    private _pluginIPCSubscriptions: {
        state: Map<number, Subscription>,
    } = {
        state: new Map(),
    };
    private _state: Map<number, IStreamStateInfo> = new Map();
    private _rows: {
        last: number,
        ranges: IRangeMapItem[],
    } = {
        last: 0,
        ranges: [],
    };

    constructor(guid: string, file: string) {
        this._guid = guid;
        this._file = file;
        this._stream = fs.createWriteStream(this._file);
        this._reader = new ControllerStreamFileReader(this._guid, this._file);
        this._logger = new Logger(`ControllerStreamProcessor: ${this._guid}`);
        this._ipc_onStreamChunkRequested = this._ipc_onStreamChunkRequested.bind(this);
        ServiceElectron.IPC.subscribe(IPCElectronMessages.StreamChunk, this._ipc_onStreamChunkRequested);
    }

    public destroy() {
        this._stream.close();
        this._stream.removeAllListeners();
        this._reader.destroy();
    }

    public write(chunk: Buffer, pluginReference: string | undefined, pluginId?: number): Promise<void> {
        return new Promise((resolve, reject) => {
            let output: string = chunk.toString('utf8');
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
            // Process data
            output = output.replace(REGEXPS.CARRETS, '\n').replace(/\n{2,}/g, '\n');
            output = output.replace(REGEXPS.CARRETS, `${MARKERS.PLUGIN}${pluginInfo.id}${MARKERS.PLUGIN}\n`);
            if (this._lastSourceDataPluginId !== -1 && this._lastSourceDataPluginId !== pluginInfo.id) {
                // Source of data was changed.
                output = `${MARKERS.PLUGIN}${this._lastSourceDataPluginId}${MARKERS.PLUGIN}\n${output}`;
            }
            // Remember first row before update it
            const lastRowBeforeUpdate: number = this._rows.last;
            // Add rows indexes
            output = this._addRowIndexes(output);
            // Get size of buffer to be written
            const sizeToBeWritten: number = Buffer.from(output).byteLength;
            // Store indexes
            const streamLastPosition: number = this._getStreamSize();
            this._rows.ranges.push({
                bytes: { start: streamLastPosition, end: streamLastPosition + sizeToBeWritten - 1 },
                rows: { start: lastRowBeforeUpdate, end: this._rows.last - 1 },
            });
            // Remember plugin id to break like in case it will change
            this._lastSourceDataPluginId = pluginInfo.id;
            // Get state of stream
            const streamBlocked: boolean = this._isStreamBlocked();
            // Write data into session storage file
            this._stream.write(output, (writeError: Error | null | undefined) => {
                if (writeError) {
                    return reject(new Error(this._logger.error(`Fail to write data into stream file due error: ${writeError.message}`)));
                }
                !streamBlocked && this._sendToRender(output, sizeToBeWritten).then(() => {
                    resolve();
                }).catch((sendingError: Error) => {
                    reject(new Error(this._logger.error(`Fail to send stream data to render due error: ${sendingError.message}`)));
                });
            });
        });
    }

    private _addRowIndexes(str: string): string {
        str = str.replace(REGEXPS.CARRETS, () => {
            const injection: string = MARKERS.NUMBER + (this._rows.last++) + MARKERS.NUMBER;
            return `${injection}\n`;
        });
        return str;
    }

    private _getPluginInfo(pluginReference: string | undefined, id?: number): IPluginInfo | Error {
        // Attempt to find ID of plugin
        const pluginId: number | undefined = pluginReference === undefined ? id : this._pluginRefs.get(pluginReference);
        if (pluginId === undefined) {
            return new Error(`Fail to find plugin ID. Chunk of data will not be forward.`);
        }
        // Get token
        const pluginToken: string | undefined = ServicePlugins.getPluginToken(pluginId);
        if (pluginToken === undefined) {
            return new Error(`Fail to find plugin token by ID of plugin: id = "${pluginId}". Chunk of data will not be forward.`);
        }
        return { id: pluginId, token: pluginToken };
    }

    private _isStreamBlocked(): boolean {
        return this._state.size > 0;
    }

    private _sendToRender(output: string, size: number): Promise<void> {
        return new Promise((resolve) => {
            // Check is stream blocked
            if (this._isStreamBlocked()) {
                return resolve();
            }
            this._sendUpdateStreamData(
                size <= this._maxSizeOfChunkToBeSentWithUpdate ? output : undefined,
            ).then(() => {
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

    private _sendUpdateStreamData(output?: string): Promise<void> {
        return ServiceElectron.IPC.send(new IPCElectronMessages.StreamUpdated({
            guid: this._guid,
            length: this._getStreamSize(),
            rows: this._rows.last,
        }));
    }

    private _getStreamSize(): number {
        return this._stream.bytesWritten;
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
                length: this._getStreamSize(),
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
                length: this._getStreamSize(),
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
