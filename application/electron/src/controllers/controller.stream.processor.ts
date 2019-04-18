import * as fs from 'fs';
import Logger from '../tools/env.logger';
import ServiceElectron, { IPCMessages as IPCElectronMessages, Subscription } from '../services/service.electron';
import ServicePlugins from '../services/service.plugins';
import ControllerIPCPlugin, { IPCMessages as IPCPluginMessages} from './controller.plugin.process.ipc';
import ControllerStreamFileReader from './controller.stream.file.reader';
import Transform, { ITransformResult } from './controller.stream.processor.pipe.transform';
import { IMapItem } from './controller.stream.processor.map';
import State from './controller.stream.processor.state';

export interface IPluginInfo {
    id: number;
    token: string;
}

export interface IStreamStateInfo {
    started: number;
    memoryUsed: number;
}

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
    private _memUsage: Map<number, IStreamStateInfo> = new Map();
    private _transform: Transform;
    private _subscriptions: { [key: string ]: Subscription | undefined } = { };
    private _state: State;

    constructor(guid: string, file: string) {
        this._guid = guid;
        this._file = file;
        this._stream = fs.createWriteStream(this._file, { encoding: 'utf8' });
        this._reader = new ControllerStreamFileReader(this._guid, this._file);
        this._logger = new Logger(`ControllerStreamProcessor: ${this._guid}`);
        this._state = new State(this._guid);
        this._transform = new Transform({}, this._guid, this._state);
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
            const st: number = Date.now();
            let output: string = '';
            if (typeof chunk === 'string') {
                output = chunk;
            } else {
                output = chunk.toString('utf8');
            }
            // Binding ref with ID of plugin
            if (pluginReference !== undefined && this._bindPlugin(output, pluginReference) === true) {
                // This is binding message. No need to process it forward.
                return resolve();
            }
            // Get plugin info
            const pluginInfo: IPluginInfo | Error = this._getPluginInfo(pluginReference, pluginId);
            if (pluginInfo instanceof Error) {
                return reject(new Error(`Fail to write data due error: ${pluginInfo.message}`));
            }
            // Set plugin
            this._transform.setPluginId(pluginInfo.id);
            // Convert chunk to string
            const converted: ITransformResult = this._transform.convert(output);
            // Write data
            this._stream.write(converted.output, (writeError: Error | null | undefined) => {
                if (writeError) {
                    return reject(new Error(this._logger.error(`Fail to write data into stream file due error: ${writeError.message}`)));
                }
                resolve();
            });
        });
    }

    public pipe(reader: fs.ReadStream) {
        this._transform.setPluginId(1);
        reader.pipe(this._transform).pipe(this._stream, { end: false});
    }

    public addPipeSession(pipeId: string, size: number, name: string) {
        this._state.pipes.add(pipeId, size, name);
    }

    public removePipeSession(pipeId: string) {
        this._state.pipes.remove(pipeId);
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
            this._memUsage.set(id, {
                started: Date.now(),
                memoryUsed: process.memoryUsage().heapUsed / 1024 / 1024,
            });
        } else if (this._memUsage.has(id)) {
            const stateInfo: IStreamStateInfo = this._memUsage.get(id) as IStreamStateInfo;
            const memory = {
                used: process.memoryUsage().heapUsed / 1024 / 1024,
                total: process.memoryUsage().heapTotal / 1024 / 1024,
            };
            this._logger.env(`Session was closed by plugin #${id} in ${((Date.now() - stateInfo.started) / 1000).toFixed(2)}s. Memory: on start: ${stateInfo.memoryUsed.toFixed(2)}Mb; on end: ${memory.used.toFixed(2)}/${memory.used.toFixed(2)}Mb; diff: ${(memory.used - stateInfo.memoryUsed).toFixed(2)}Mb`);
            // Close "long chunk" by carret
            this.write(Buffer.from('\n'), undefined, id);
            this._sendUpdateStreamData();
            this._memUsage.delete(id);
        } else {
            this._logger.warn(`Cannot close session for plugin ${id} because session wasn't started.`);
        }
    }

    private _onSessionStreamPipeStarted(id: number, message: IPCPluginMessages.SessionStreamPipeStarted) {
        if (message.streamId !== this._guid) {
            return;
        }
        this._state.pipes.add(message.pipeId, message.size, message.name);
    }

    private _onSessionStreamPipeFinished(id: number, message: IPCPluginMessages.SessionStreamPipeFinished) {
        if (message.streamId !== this._guid) {
            return;
        }
        this._state.pipes.remove(message.pipeId);
    }

    private _sendUpdateStreamData(complete?: string, from?: number, to?: number): Promise<void> {
        return ServiceElectron.IPC.send(new IPCElectronMessages.StreamUpdated({
            guid: this._guid,
            length: this._state.map.getByteLength(),
            rowsCount: this._state.map.getRowsCount(),
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
        const range: IMapItem | Error = this._state.map.getBytesRange({
            from: message.start,
            to: message.end,
        });
        if (range instanceof Error) {
            return response(new IPCElectronMessages.StreamChunk({
                guid: this._guid,
                start: -1,
                end: -1,
                rows: this._state.map.getRowsCount(),
                length: this._state.map.getByteLength(),
                error: this._logger.error(`Fail to process StreamChunk request due error: ${range.message}`),
            }));
        }
        // Reading chunk
        this._reader.read(range.bytes.from, range.bytes.to).then((output: string) => {
            response(new IPCElectronMessages.StreamChunk({
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
