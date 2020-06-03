import * as fs from 'fs';
import * as Stream from 'stream';

import Logger from '../../tools/env.logger';
import ServiceElectron from '../../services/service.electron';
import ServicePlugins from '../../services/service.plugins';
import ServiceStreamSource from '../../services/service.stream.sources';
import State from './state';
import ControllerIPCPlugin from '../plugins/plugin.process.ipc';

import { IMapItem } from './file.map';
import { EventsHub } from '../stream.common/events';
import { FileWriter } from './file.writer';
import { DefaultOutputExport } from './output.export.default';
import { IPCMessages as IPCPluginMessages } from '../plugins/plugin.process.ipc';
import { IPCMessages as IPCElectronMessages, Subscription } from '../../services/service.electron';

export interface IPipeOptions {
    reader: fs.ReadStream;
    pipeId: string;
    sourceId: number;
    decoder?: Stream.Transform;
}

export interface ISourceInfo {
    id: number;
    token: string | undefined;
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
    private _stream: fs.WriteStream | undefined;
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
    private _subscriptions: { [key: string ]: Subscription } = { };
    private _state: State;
    private _events: EventsHub;
    private _writer: FileWriter;
    private _export: DefaultOutputExport;

    constructor(guid: string, file: string, events: EventsHub) {
        this._guid = guid;
        this._file = file;
        this._events = events;
        this._logger = new Logger(`ControllerStreamProcessor: ${this._guid}`);
        this._state = new State(this._guid, this._file);
        this._writer = new FileWriter(guid, file, this._state.map);
        this._export = new DefaultOutputExport(guid);
        this._writer.on(FileWriter.Events.ChunkWritten, this._onChunkWritten.bind(this));
        this._ipc_onStreamChunkRequested = this._ipc_onStreamChunkRequested.bind(this);
        ServiceElectron.IPC.subscribe(IPCElectronMessages.StreamChunk, this._ipc_onStreamChunkRequested).then((subscription: Subscription) => {
            this._subscriptions.StreamChunk = subscription;
        }).catch((error: Error) => {
            this._logger.warn(`Fail to subscribe to render event "StreamChunk" due error: ${error.message}. This is not blocked error, loading will be continued.`);
        });
    }

    public destroy(): Promise<void> {
        return new Promise((resolve) => {
            this._state.destroy();
            this._writer.removeAllListeners();
            this._export.destroy();
            // Unsubscribe IPC messages / events
            Object.keys(this._subscriptions).forEach((key: string) => {
                this._subscriptions[key].destroy();
            });
            this._writer.destroy().then(resolve).catch((error: Error) => {
                this._logger.error(`Fail to correctly destroy writer due error: ${error.message}`);
                resolve();
            });
        });
    }

    public write(chunk: Buffer | string, pluginReference: string | undefined, trackId: string | undefined, pluginId?: number): Promise<void> {
        return new Promise((resolve, reject) => {
            let output: string = '';
            if (typeof chunk === 'string') {
                output = chunk;
            } else {
                output = chunk.toString('utf8');
            }
            // Binding ref with ID of plugin
            if (pluginReference !== undefined && this._bindPluginRef(output, pluginReference) === true) {
                // This is binding message. No need to process it forward.
                return resolve();
            }
            // Get plugin info
            const sourceInfo: ISourceInfo | Error = this._getSourceInfo(pluginReference, pluginId);
            if (sourceInfo instanceof Error) {
                return reject(new Error(`Fail to write data due error: ${sourceInfo.message}`));
            }
            this._writer.write(output, sourceInfo.id).then(() => {
                // Send notification to render
                this._state.postman.notification();
                resolve();
            }).catch(reject);
        });
    }

    public addProgressSession(pipeId: string, name: string) {
        this._state.progress.add(pipeId, name);
        this._dropStreamFile();
    }

    public removeProgressSession(pipeId: string) {
        this._state.progress.remove(pipeId);
    }

    public updateProgressSession(id: string, progress: number) {
        this._state.progress.next(id, progress);
    }

    public rewriteStreamFileMap(map: IMapItem[]) {
        this._state.map.rewrite(map);
        this._notify({
            bytes: {
                from: map.length !== 0 ? map[0].bytes.from : -1,
                to: map.length !== 0 ? map[map.length - 1].bytes.to : -1,
            },
            rows: {
                from: map.length !== 0 ? map[0].rows.from : -1,
                to: map.length !== 0 ? map[map.length - 1].rows.to : -1,
            },
        });
    }

    public pushToStreamFileMap(map: IMapItem[]) {
        this._state.map.push(map);
        this._notify({
            bytes: {
                from: map.length !== 0 ? map[0].bytes.from : -1,
                to: map.length !== 0 ? map[map.length - 1].bytes.to : -1,
            },
            rows: {
                from: map.length !== 0 ? map[0].rows.from : -1,
                to: map.length !== 0 ? map[map.length - 1].rows.to : -1,
            },
        });
    }

    public reattach() {
        this._writer.stop();
        this._writer.resume();
    }

    public reset(): Promise<void> {
        return new Promise((resolve, reject) => {
            this._writer.stop();
            // Close stream
            if (this._stream !== undefined) {
                this._stream.close();
                this._stream = undefined;
            }
            // Drop stream file
            fs.unlink(this._file, (error: NodeJS.ErrnoException | null) => {
                if (error) {
                    return reject(error);
                }
                // Drop map
                this._state.map.drop();
                this._writer.resume();
                // Notification
                this._notify();
                resolve();
            });
        });
    }

    public getStreamSize(): number {
        return this._state.map.getByteLength();
    }

    public getStreamLength(): number {
        return this._state.map.getRowsCount();
    }

    private _onChunkWritten(map: IMapItem) {
        // Trigger event on stream was updated
        this._events.getSubject().onStreamBytesMapUpdated.emit({
            bytes: Object.assign({}, map.bytes),
            rows: Object.assign({}, map.rows),
        });
    }

    private _dropStreamFile() {
        if (this._stream === undefined) {
            return;
        }
        this._stream.close();
        this._stream.removeAllListeners();
        this._stream = undefined;
    }

    private _getSourceInfo(pluginReference: string | undefined, id?: number): ISourceInfo | Error {
        // Check source before
        if (id !== undefined && ServiceStreamSource.get(id) !== undefined) {
            return { id: id, token: undefined };
        }
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

    private _bindPluginRef(chunk: string, ref: string): boolean {
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
        // Add source description
        ServiceStreamSource.set(id, { name: ServicePlugins.getPluginName(id) as string, session: '*' });
        // Bind plugin ref with plugin ID
        this._pluginRefs.set(ref, id);
        this._logger.debug(`Plugin #${id} (${ServicePlugins.getPluginName(id)}) bound with reference "${ref}".`);
        // Get IPC of plugin
        const IPC: ControllerIPCPlugin | undefined = ServicePlugins.getPluginIPC(this._guid, token);
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
            this._logger.debug(`Session was closed by plugin #${id} in ${((Date.now() - stateInfo.started) / 1000).toFixed(2)}s. Memory: on start: ${stateInfo.memoryUsed.toFixed(2)}Mb; on end: ${memory.used.toFixed(2)}/${memory.used.toFixed(2)}Mb; diff: ${(memory.used - stateInfo.memoryUsed).toFixed(2)}Mb`);
            // Close "long chunk" by carret
            this.write(Buffer.from('\n'), undefined, undefined, id);
            this._notify();
            this._memUsage.delete(id);
        } else {
            this._logger.warn(`Cannot close session for plugin ${id} because session wasn't started.`);
        }
    }

    private _onSessionStreamPipeStarted(id: number, message: IPCPluginMessages.SessionStreamPipeStarted) {
        if (message.streamId !== this._guid) {
            return;
        }
        // TODO: add opening of progress tracking
    }

    private _onSessionStreamPipeFinished(id: number, message: IPCPluginMessages.SessionStreamPipeFinished) {
        if (message.streamId !== this._guid) {
            return;
        }
        // TODO: add closing of progress tracking
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
        this._state.reader.read(range.bytes.from, range.bytes.to).then((output: string) => {
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

    private _notify(map?: IMapItem) {
        // Send notification to render
        this._state.postman.notification();
        if (map !== undefined) {
            // Trigger event on stream was updated
            this._events.getSubject().onStreamBytesMapUpdated.emit(map);
        }
    }

}
