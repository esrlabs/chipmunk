import * as fs from 'fs';
import * as Stream from 'stream';
import Logger from '../tools/env.logger';
import ServiceElectron, { IPCMessages as IPCElectronMessages, Subscription } from '../services/service.electron';
import ServicePlugins from '../services/service.plugins';
import ServiceStreamSource from '../services/service.stream.sources';
import ControllerIPCPlugin, { IPCMessages as IPCPluginMessages} from './controller.plugin.process.ipc';
import Transform, { ITransformResult } from './controller.stream.processor.pipe.transform';
import { IMapItem } from './controller.stream.processor.map';
import State from './controller.stream.processor.state';
import StreamState from './controller.stream.state';
import { IRange } from './controller.stream.processor.map';

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
    private _subscriptions: { [key: string ]: Subscription | undefined } = { };
    private _state: State;
    private _streamState: StreamState;
    private _blocked: boolean = false;

    constructor(guid: string, file: string, streamState: StreamState) {
        this._guid = guid;
        this._file = file;
        this._streamState = streamState;
        this._logger = new Logger(`ControllerStreamProcessor: ${this._guid}`);
        this._state = new State(this._guid, this._file);
        this._ipc_onStreamChunkRequested = this._ipc_onStreamChunkRequested.bind(this);
        ServiceElectron.IPC.subscribe(IPCElectronMessages.StreamChunk, this._ipc_onStreamChunkRequested).then((subscription: Subscription) => {
            this._subscriptions.StreamChunk = subscription;
        }).catch((error: Error) => {
            this._logger.warn(`Fail to subscribe to render event "StreamChunk" due error: ${error.message}. This is not blocked error, loading will be continued.`);
        });
    }

    public destroy(): Promise<void> {
        return new Promise((resolve, reject) => {
            this._state.destroy();
            // Unsubscribe IPC messages / events
            Object.keys(this._subscriptions).forEach((key: string) => {
                (this._subscriptions as any)[key].destroy();
            });
            resolve();
        });
    }

    public write(chunk: Buffer, pluginReference: string | undefined, trackId: string | undefined, pluginId?: number): Promise<void> {
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
            // Convert chunk to string
            const transform: Transform = new Transform( {},
                                                        this._guid,
                                                        sourceInfo.id,
                                                        { bytes: this._state.map.getByteLength(), rows: this._state.map.getRowsCount() });
            transform.setBeforeCallbackHandle((converted: ITransformResult) => {
                return new Promise((resolveBeforeCallback, rejectBeforeCallback) => {
                    // Add data into map
                    this._state.map.add(converted.map);
                    // Add data in progress
                    if (trackId !== undefined) {
                        this._state.pipes.next(trackId, converted.bytesSize);
                    }
                    // Write data
                    const stream: fs.WriteStream | undefined = this._getStreamFileHandle();
                    if (stream === undefined) {
                        return reject(new Error(`Stream is blocked for writting.`));
                    }
                    stream.write(converted.output, (writeError: Error | null | undefined) => {
                        // Send notification to render
                        this._state.postman.notification();
                        // Trigger event on stream was updated
                        this._streamState.getSubject().onStreamBytesMapUpdated.emit(converted.map.bytes);
                        if (writeError) {
                            const error: Error = new Error(this._logger.error(`Fail to write data into stream file due error: ${writeError.message}`));
                            rejectBeforeCallback(error);
                            return reject(error);
                        }
                        resolveBeforeCallback();
                        resolve();
                    });
                });
            });
            transform.convert(output);
        });
    }

    public pipe(options: IPipeOptions): Error | undefined {
        // Get plugin info
        const sourceInfo: ISourceInfo | Error = this._getSourceInfo(undefined, options.sourceId);
        if (sourceInfo instanceof Error) {
            return new Error(`Fail to pipe data due error: ${sourceInfo.message}`);
        }
        const transform: Transform = new Transform( {},
                                                    this._guid,
                                                    options.sourceId,
                                                    { bytes: this._state.map.getByteLength(), rows: this._state.map.getRowsCount() });
        const stream: fs.WriteStream | undefined = this._getStreamFileHandle();
        if (stream === undefined) {
            return new Error(`Stream is blocked for writting.`);
        }
        transform.on(Transform.Events.onMap, (map: IMapItem, written: number) => {
            // Add data into map
            this._state.map.add(map);
            // Add data in progress
            this._state.pipes.next(options.pipeId, written);
            // Send notification to render
            this._state.postman.notification();
        });
        stream.once('finish', () => {
            const map: IMapItem[] = transform.getMap();
            if (map.length === 0) {
                this._logger.warn(`Transformer doesn't have any item of map`);
                return;
            }
            // Send notification to render
            this._state.postman.notification();
            // Trigger event on stream was updated
            this._streamState.getSubject().onStreamBytesMapUpdated.emit({ from: map[0].bytes.from, to: map[map.length - 1].bytes.to });
        });
        if (options.decoder !== undefined) {
            options.reader.pipe(options.decoder).pipe(transform).pipe(stream);
        } else {
            options.reader.pipe(transform).pipe(stream);
        }
    }

    public addPipeSession(pipeId: string, size: number, name: string) {
        this._state.pipes.add(pipeId, size, name);
        this._dropStreamFile();
    }

    public removePipeSession(pipeId: string) {
        this._state.pipes.remove(pipeId);
    }

    public updatePipeSession(pipeId: string, written: number) {
        this._state.pipes.next(pipeId, written);
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
            from: map.length !== 0 ? map[0].bytes.from : -1,
            to: map.length !== 0 ? map[map.length - 1].bytes.to : -1,
        });
    }

    public pushToStreamFileMap(map: IMapItem[]) {
        this._state.map.push(map);
        this._notify({
            from: map.length !== 0 ? map[0].bytes.from : -1,
            to: map.length !== 0 ? map[map.length - 1].bytes.to : -1,
        });
    }

    public reattach() {
        this._getStreamFileHandle();
    }

    public reset(): Promise<void> {
        return new Promise((resolve, reject) => {
            this._blocked = true;
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
                this._blocked = false;
                // Reattach reader
                this._getStreamFileHandle();
                // Notification
                this._notify();
                resolve();
            });
        });
    }

    private _getStreamFileHandle(): fs.WriteStream | undefined {
        if (this._blocked) {
            return undefined;
        }
        if (this._stream === undefined) {
            this._stream = fs.createWriteStream(this._file, { encoding: 'utf8', flags: 'a' });
        }
        return this._stream;
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
        this._logger.env(`Plugin #${id} (${ServicePlugins.getPluginName(id)}) bound with reference "${ref}".`);
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
            this._logger.env(`Session was closed by plugin #${id} in ${((Date.now() - stateInfo.started) / 1000).toFixed(2)}s. Memory: on start: ${stateInfo.memoryUsed.toFixed(2)}Mb; on end: ${memory.used.toFixed(2)}/${memory.used.toFixed(2)}Mb; diff: ${(memory.used - stateInfo.memoryUsed).toFixed(2)}Mb`);
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
        this._state.pipes.add(message.pipeId, message.size, message.name);
    }

    private _onSessionStreamPipeFinished(id: number, message: IPCPluginMessages.SessionStreamPipeFinished) {
        if (message.streamId !== this._guid) {
            return;
        }
        this._state.pipes.remove(message.pipeId);
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

    private _notify(bytes?: IRange) {
        // Send notification to render
        this._state.postman.notification();
        if (bytes !== undefined) {
            // Trigger event on stream was updated
            this._streamState.getSubject().onStreamBytesMapUpdated.emit(bytes);
        }
    }

}
