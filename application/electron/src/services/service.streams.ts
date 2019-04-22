import * as Path from 'path';
import * as fs from 'fs';
import * as Net from 'net';
import * as FS from '../tools/fs';
import { EventEmitter } from 'events';
import ServicePaths from './service.paths';
import ServiceElectron, { IPCMessages as IPCElectronMessages, Subscription } from './service.electron';
import Logger from '../tools/env.logger';
import ControllerStreamSearch from '../controllers/controller.stream.search';
import ControllerStreamProcessor from '../controllers/controller.stream.processor';
import { IService } from '../interfaces/interface.service';
import * as Tools from '../tools/index';

export interface IStreamInfo {
    guid: string;
    socketFile: string;
    streamFile: string;
    searchFile: string;
    connections: Net.Socket[];
    connectionFactory: (pluginName: string) => Promise<{ socket: Net.Socket, file: string }>;
    server: Net.Server;
    processor: ControllerStreamProcessor;
    search: ControllerStreamSearch;
    received: number;
}

type TGuid = string;

/**
 * @class ServiceStreams
 * @description Controlls data streams of application
 */

class ServiceStreams extends EventEmitter implements IService  {

    public EVENTS = {
        streamAdded: 'streamAdded',
        streamRemoved: 'streamRemoved',
    };

    private _logger: Logger = new Logger('ServiceStreams');
    private _streams: Map<TGuid, IStreamInfo> = new Map();
    private _activeStreamGuid: string = '';
    private _subscriptions: { [key: string ]: Subscription | undefined } = { };

    constructor() {
        super();
        // Binding
        this._ipc_onStreamSetActive = this._ipc_onStreamSetActive.bind(this);
        this._ipc_onStreamAdd = this._ipc_onStreamAdd.bind(this);
        this._ipc_onStreamRemove = this._ipc_onStreamRemove.bind(this);
    }

    /**
     * Initialization function
     * @returns Promise<void>
     */
    public init(): Promise<void> {
        return new Promise((resolve, reject) => {
            // Cleanup folder with sockets files
            this._cleanUp().then(resolve).catch(reject);
            // Subscribe to IPC messages / errors
            ServiceElectron.IPC.subscribe(IPCElectronMessages.StreamAdd, this._ipc_onStreamAdd).then((subscription: Subscription) => {
                this._subscriptions.streamAdd = subscription;
            }).catch((error: Error) => {
                this._logger.warn(`Fail to subscribe to render event "StreamAdd" due error: ${error.message}. This is not blocked error, loading will be continued.`);
            });
            ServiceElectron.IPC.subscribe(IPCElectronMessages.StreamRemove, this._ipc_onStreamRemove).then((subscription: Subscription) => {
                this._subscriptions.streamRemove = subscription;
            }).catch((error: Error) => {
                this._logger.warn(`Fail to subscribe to render event "StreamRemove" due error: ${error.message}. This is not blocked error, loading will be continued.`);
            });
            ServiceElectron.IPC.subscribe(IPCElectronMessages.StreamSetActive, this._ipc_onStreamSetActive).then((subscription: Subscription) => {
                this._subscriptions.StreamSetActive = subscription;
            }).catch((error: Error) => {
                this._logger.warn(`Fail to subscribe to render event "StreamSetActive" due error: ${error.message}. This is not blocked error, loading will be continued.`);
            });
        });
    }

    public getName(): string {
        return 'ServiceStreams';
    }

    public destroy(): Promise<void> {
        return new Promise((resolve) => {
            // Unsubscribe IPC messages / events
            Object.keys(this._subscriptions).forEach((key: string) => {
                (this._subscriptions as any)[key].destroy();
            });
            // Destroy all connections / servers to UNIX sockets
            this._streams.forEach((stream: IStreamInfo, guid: TGuid) => {
                stream.connections.forEach((connection: Net.Socket) => {
                    connection.removeAllListeners();
                    connection.unref();
                    connection.destroy();
                });
                stream.connections = [];
                stream.server.unref();
                stream.processor.destroy();
            });
            // Remove all UNIX socket's files
            this._cleanUp().then(() => {
                resolve();
            }).catch((clearError: Error) => {
                this._logger.warn(`Fail to cleanup sockets folder due error: ${clearError.message}`);
                resolve();
            });
        });
    }

    public writeTo(chunk: Buffer, sourceId: number, streamId?: string): Promise<void> {
        return new Promise((resolve, reject) => {
            // Get stream id
            if (streamId === undefined) {
                streamId = this._activeStreamGuid;
            }
            // Get stream info
            const stream: IStreamInfo | undefined = this._streams.get(streamId);
            if (stream === undefined) {
                return reject(new Error(this._logger.warn(`Fail to find a stream data for stream guid "${streamId}"`)));
            }
            stream.processor.write(chunk, undefined, sourceId).then(() => {
                // Operation done
                stream.received += chunk.length;
                resolve();
            }).catch((errorWrite: Error) => {
                return reject(new Error(this._logger.warn(`Fail to process data from stream (${streamId}) due error: ${errorWrite.message}`)));
            });
        });
    }

    public pipeWith(reader: fs.ReadStream, sourceId: number, streamId?: string): Promise<void> {
        return new Promise((resolve, reject) => {
            // Get stream id
            if (streamId === undefined) {
                streamId = this._activeStreamGuid;
            }
            // Get stream info
            const stream: IStreamInfo | undefined = this._streams.get(streamId);
            if (stream === undefined) {
                return reject(new Error(this._logger.warn(`Fail to find a stream data for stream guid "${streamId}"`)));
            }
            reader.once('end', () => {
                resolve();
            });
            stream.processor.pipe(reader, sourceId);
        });
    }

    public addPipeSession(id: string, size: number, name: string, streamId?: string) {
        // Get stream id
        if (streamId === undefined) {
            streamId = this._activeStreamGuid;
        }
        // Get stream info
        const stream: IStreamInfo | undefined = this._streams.get(streamId);
        if (stream === undefined) {
            return;
        }
        stream.processor.addPipeSession(id, size, name);
    }

    public removePipeSession(id: string, streamId?: string) {
        // Get stream id
        if (streamId === undefined) {
            streamId = this._activeStreamGuid;
        }
        // Get stream info
        const stream: IStreamInfo | undefined = this._streams.get(streamId);
        if (stream === undefined) {
            return;
        }
        stream.processor.removePipeSession(id);
    }

    /**
     * Creates new stream socket
     * @returns Promise<IStreamInfo>
     */
    private _createStream(guid: string): Promise<IStreamInfo> {
        return new Promise((resolve, reject) => {
            // const socketFile: string = Path.resolve(ServicePaths.getSockets(), `test.sock`);
            const socketFile: string = this._getSocketFileName(`${Date.now()}-${guid}`);
            const streamFile: string = Path.resolve(ServicePaths.getStreams(), `${Date.now()}-${guid}.stream`);
            const searchFile: string = Path.resolve(ServicePaths.getStreams(), `${Date.now()}-${guid}.search`);
            try {
                // Create new server
                const server: Net.Server = Net.createServer(this._acceptConnectionToSocket.bind(this, guid));
                // Create connection to trigger creation of server
                const stream: IStreamInfo = {
                    guid: guid,
                    socketFile: socketFile,
                    streamFile: streamFile,
                    searchFile: searchFile,
                    server: server,
                    connections: [],
                    connectionFactory: (pluginName: string): Promise<{ socket: Net.Socket, file: string }> => {
                        return new Promise((resolveConnection) => {
                            const socket: Net.Socket = Net.connect(socketFile, () => {
                                this._logger.env(`Created new connection UNIX socket: ${socketFile} for plugin "${pluginName}".`);
                                resolveConnection({ socket: socket, file: socketFile });
                            });
                            (socket as any).__id = Tools.guid();
                        });
                    },
                    processor: new ControllerStreamProcessor(guid, streamFile),
                    search: new ControllerStreamSearch(guid, streamFile, searchFile),
                    received: 0,
                };
                // Bind server with file
                server.listen(socketFile);
                // Listen errors
                server.on('error', (error: Error) => {
                    this._logger.error(`Error on socket "${socketFile}": ${error.message}`);
                });
                // Store stream data
                this._streams.set(guid, stream);
                // Resolve / finish
                resolve(stream);
            } catch (e) {
                reject(e);
            }
        });
    }

    private _acceptConnectionToSocket(guid: string, socket: Net.Socket) {
        const stream: IStreamInfo | undefined = this._streams.get(guid);
        if (stream === undefined) {
            return this._logger.error(`Accepted connection to stream "${guid}", which doesn't exist anymore.`);
        }
        // Create ref to plugin
        const pluginRef: string = Tools.guid();
        // Start listen new connection
        socket.on('data', this._stream_onData.bind(this, guid, pluginRef));
        this._logger.env(`New connection to stream "${guid}" is accepted. Reference: ${pluginRef}`);
        stream.connections.push(socket);
    }

    private _destroyStream(guid: string): Promise<void> {
        return new Promise((resolve) => {
            const stream: IStreamInfo | undefined = this._streams.get(guid);
            if (stream === undefined) {
                this._logger.warn(`Was gotten command to destroy stream, but stream wasn't found in storage.`);
                return;
            }
            const socketFile = stream.socketFile;
            const streamFile = stream.streamFile;
            stream.connections.forEach((connection: Net.Socket) => {
                connection.removeAllListeners();
                connection.unref();
                connection.destroy();
            });
            stream.server.unref();
            stream.connections = [];
            stream.processor.destroy();
            this._streams.delete(guid);
            Promise.all([
                new Promise((resolveUnlink) => {
                    fs.unlink(socketFile, (removeSocketFileError: NodeJS.ErrnoException | null) => {
                        if (removeSocketFileError) {
                            this._logger.warn(`Fail to remove stream socket file ${socketFile} due error: ${removeSocketFileError.message}`);
                        }
                        resolveUnlink();
                    });
                }),
                new Promise((resolveUnlink) => {
                    fs.unlink(streamFile, (removeStreamFileError: NodeJS.ErrnoException | null) => {
                        if (removeStreamFileError) {
                            this._logger.warn(`Fail to remove stream socket file ${streamFile} due error: ${removeStreamFileError.message}`);
                        }
                        resolveUnlink();
                    });
                }),
            ]).then(() => {
                resolve();
            });
        });
    }

    /**
     * Read sockets folder and remove all files from there
     * @returns Promise<void>
     */
    private _cleanUp(): Promise<void> {
        return new Promise((resolve, reject) => {
            Promise.all([
                FS.readFolder(ServicePaths.getSockets(), FS.EReadingFolderTarget.files),
                FS.readFolder(ServicePaths.getStreams(), FS.EReadingFolderTarget.files),
            ]).then((result: [ string[], string[] ]) => {
                const files: string[] = [];
                files.push(...result[0].map((file: string) => Path.resolve(ServicePaths.getSockets(), file) ));
                files.push(...result[1].map((file: string) => Path.resolve(ServicePaths.getStreams(), file) ));
                const queue: Array<Promise<void>> = files.map((file: string) => {
                    return new Promise((resolveUnlink) => {
                        fs.unlink(file, (errorUnlink: NodeJS.ErrnoException | null) => {
                            if (errorUnlink) {
                                this._logger.warn(`Fail to remove ${file} due error: ${errorUnlink.message}`);
                            }
                            // Resolve in anyway
                            resolveUnlink();
                        });
                    });
                });
                Promise.all(queue).then(() => {
                    resolve();
                }).catch(reject);
            }).catch((readingError: Error) => {
                this._logger.error(`Fail to read folder ${ServicePaths.getPlugins()} or ${ServicePaths.getStreams()} due error: ${readingError.message}`);
                reject(readingError);
            });
        });
    }

    private _ipc_onStreamAdd(message: IPCElectronMessages.TMessage) {
        if (!(message instanceof IPCElectronMessages.StreamAdd)) {
            return;
        }
        // Create stream
        this._createStream(message.guid).then((stream: IStreamInfo) => {
            // Check active
            if (this._activeStreamGuid === '') {
                this._activeStreamGuid = stream.guid;
            }
            // Notify plugins server about new stream
            this.emit(this.EVENTS.streamAdded, stream, message.transports);
        }).catch((streamCreateError: Error) => {
            this._logger.error(`Fail to create stream due error: ${streamCreateError.message}`);
        });
    }

    private _ipc_onStreamRemove(message: IPCElectronMessages.TMessage) {
        if (!(message instanceof IPCElectronMessages.StreamRemove)) {
            return;
        }
        this._destroyStream(message.guid).then(() => {
            this.emit(this.EVENTS.streamRemoved);
            // TODO: forward actions to other compoenents
        });
    }

    private _ipc_onStreamSetActive(message: IPCElectronMessages.TMessage) {
        if (!(message instanceof IPCElectronMessages.StreamSetActive)) {
            return;
        }
        this._activeStreamGuid = message.guid;
        this._logger.env(`Active session is set to: ${this._activeStreamGuid}`);
    }

    private _stream_onData(guid: string, ref: string, chunk: Buffer) {
        // Get stream info
        const stream: IStreamInfo | undefined = this._streams.get(guid);
        if (stream === undefined) {
            return this._logger.warn(`Fail to find a stream data for stream guid "${guid}"`);
        }
        stream.processor.write(chunk, ref).then(() => {
            // Operation done
            stream.received += chunk.length;
        }).catch((errorWrite: Error) => {
            this._logger.warn(`Fail to process data from stream (${guid}) due error: ${errorWrite.message}`);
        });
    }

    private _getSocketFileName(base: string): string {
        if (process.platform === 'win32') {
            return `\\\\.\\pipe\\${base}`;
        } else {
            return Path.resolve(ServicePaths.getSockets(), `${base}.sock`);
        }
    }

}

export default (new ServiceStreams());
