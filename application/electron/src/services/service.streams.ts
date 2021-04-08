import * as Path from 'path';
import * as fs from 'fs';
import * as Net from 'net';
import * as FS from '../tools/fs';
import * as Stream from 'stream';
import * as Tools from '../tools/index';

import ServicePaths from './service.paths';
import ServiceUserPaths from './service.paths.user';
import ServicePlugins from './service.plugins';
import ServiceElectron from './service.electron';
import Logger from '../tools/env.logger';
import ControllerStreamSearch from '../controllers/stream.search/controller';
import ControllerStreamCharts from '../controllers/stream.charts/controller';
import ControllerStreamRanges from '../controllers/stream.ranges/controller';
import ControllerStreamProcessor from '../controllers/stream.main/controller';
import ControllerStreamShell from '../controllers/stream.shell/controller';

import { IPCMessages as IPCElectronMessages, Subscription } from './service.electron';
import { EventsHub } from '../controllers/stream.common/events';
import { IService } from '../interfaces/interface.service';
import { IMapItem } from '../controllers/stream.main/file.map';

export interface IStreamInfo {
    guid: string;
    socketFile: string;
    streamFile: string;
    searchFile: string;
    bounds: string[];
    connections: Net.Socket[];
    connectionFactory: (pluginName: string) => Promise<{ socket: Net.Socket, file: string }>;
    server: Net.Server;
    events: EventsHub;
    processor: ControllerStreamProcessor;
    search: ControllerStreamSearch;
    charts: ControllerStreamCharts;
    ranges: ControllerStreamRanges;
    shell: ControllerStreamShell;
    received: number;
}

export interface IPipeOptions {
    reader: fs.ReadStream;
    sourceId: number;
    pipeId: string;
    streamId?: string;
    decoder?: Stream.Transform;
}

export interface INewSessionEvent {
    stream: IStreamInfo;
}

export interface IServiceSubjects {
    onSessionChanged: Tools.Subject<string>;
    onSessionClosed: Tools.Subject<string>;
    onSessionCreated: Tools.Subject<INewSessionEvent>;
}

type TGuid = string;

/**
 * @class ServiceStreams
 * @description Controlls data streams of application
 */

class ServiceStreams implements IService  {

    private _logger: Logger = new Logger('ServiceStreams');
    private _streams: Map<TGuid, IStreamInfo> = new Map();
    private _activeStreamGuid: string = '';
    private _subscriptions: { [key: string ]: Subscription | undefined } = { };
    private _subjects: IServiceSubjects = {
        onSessionChanged: new Tools.Subject('onSessionChanged'),
        onSessionClosed: new Tools.Subject('onSessionClosed'),
        onSessionCreated: new Tools.Subject('onSessionCreated'),
    };

    constructor() {
        // Binding
        this._ipc_onStreamSetActive = this._ipc_onStreamSetActive.bind(this);
        this._ipc_onStreamAdd = this._ipc_onStreamAdd.bind(this);
        this._ipc_onStreamRemoveRequest = this._ipc_onStreamRemoveRequest.bind(this);
        this._ipc_onStreamReset = this._ipc_onStreamReset.bind(this);
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
            ServiceElectron.IPC.subscribe(IPCElectronMessages.StreamAddRequest, this._ipc_onStreamAdd).then((subscription: Subscription) => {
                this._subscriptions.streamAdd = subscription;
            }).catch((error: Error) => {
                this._logger.warn(`Fail to subscribe to render event "StreamAddRequest" due error: ${error.message}. This is not blocked error, loading will be continued.`);
            });
            ServiceElectron.IPC.subscribe(IPCElectronMessages.StreamRemoveRequest, this._ipc_onStreamRemoveRequest).then((subscription: Subscription) => {
                this._subscriptions.StreamRemoveRequest = subscription;
            }).catch((error: Error) => {
                this._logger.warn(`Fail to subscribe to render event "StreamRemove" due error: ${error.message}. This is not blocked error, loading will be continued.`);
            });
            ServiceElectron.IPC.subscribe(IPCElectronMessages.StreamSetActive, this._ipc_onStreamSetActive).then((subscription: Subscription) => {
                this._subscriptions.StreamSetActive = subscription;
            }).catch((error: Error) => {
                this._logger.warn(`Fail to subscribe to render event "StreamSetActive" due error: ${error.message}. This is not blocked error, loading will be continued.`);
            });
            ServiceElectron.IPC.subscribe(IPCElectronMessages.StreamResetRequest, this._ipc_onStreamReset).then((subscription: Subscription) => {
                this._subscriptions.StreamReset = subscription;
            }).catch((error: Error) => {
                this._logger.warn(`Fail to subscribe to render event "StreamReset" due error: ${error.message}. This is not blocked error, loading will be continued.`);
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
            this.closeAll().catch((error: Error) => {
                this._logger.warn(`Fail to close all session due error: ${error.message}`);
            }).finally(() => {
                resolve();
            });
        });
    }

    public getSubjects(): IServiceSubjects {
        return this._subjects;
    }

    public addStream(): Promise<string> {
        return new Promise((resolve, reject) => {
            this._createStream(Tools.guid()).then((info: IStreamInfo) => {
                resolve(info.guid);
                // TODO: client emit
            }).catch((error: Error) => {
                this._logger.error(`Fail to create new stream (from backend) due error: ${error.message}`);
                reject(error);
            });
        });
    }

    public writeTo(chunk: Buffer, sourceId: number, trackId: string | undefined, streamId?: string): Promise<void> {
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
            stream.processor.write(chunk, undefined, trackId, sourceId).then(() => {
                // Operation done
                stream.received += chunk.length;
                resolve();
            }).catch((errorWrite: Error) => {
                return reject(new Error(this._logger.warn(`Fail to process data from stream (${streamId}) due error: ${errorWrite.message}`)));
            });
        });
    }

    public getActiveStreamId(): string {
        return this._activeStreamGuid;
    }

    public isStreamExist(streamId: string): boolean {
        return this._streams.has(streamId);
    }

    public getStreamFile(streamId?: string): { streamId: string, file: string, bounds: string[] } | Error {
        if (streamId === undefined) {
            streamId = this._activeStreamGuid;
        }
        // Get stream info
        const stream: IStreamInfo | undefined = this._streams.get(streamId);
        if (stream === undefined) {
            return new Error(this._logger.warn(`Cannot return stream's filename, because fail to find a stream data for stream guid "${streamId}"`));
        }
        return { streamId: streamId, file: stream.streamFile, bounds: stream.bounds };
    }

    public getStreamLen(streamId?: string): number | Error {
        if (streamId === undefined) {
            streamId = this._activeStreamGuid;
        }
        // Get stream info
        const stream: IStreamInfo | undefined = this._streams.get(streamId);
        if (stream === undefined) {
            return new Error(this._logger.warn(`Cannot return stream's filename, because fail to find a stream data for stream guid "${streamId}"`));
        }
        return stream.processor.getStreamLength();
    }

    public addProgressSession(id: string, name: string, streamId?: string) {
        // Get stream id
        if (streamId === undefined) {
            streamId = this._activeStreamGuid;
        }
        // Get stream info
        const stream: IStreamInfo | undefined = this._streams.get(streamId);
        if (stream === undefined) {
            return;
        }
        stream.processor.addProgressSession(id, name);
    }

    public removeProgressSession(id: string, streamId?: string) {
        // Get stream id
        if (streamId === undefined) {
            streamId = this._activeStreamGuid;
        }
        // Get stream info
        const stream: IStreamInfo | undefined = this._streams.get(streamId);
        if (stream === undefined) {
            return;
        }
        stream.processor.removeProgressSession(id);
    }

    public updateProgressSession(trackId: string, progress: number, streamId?: string) {
        // Get stream id
        if (streamId === undefined) {
            streamId = this._activeStreamGuid;
        }
        // Get stream info
        const stream: IStreamInfo | undefined = this._streams.get(streamId);
        if (stream === undefined) {
            return;
        }
        stream.processor.updateProgressSession(trackId, progress);
    }

    public reattachSessionFileHandle(streamId?: string) {
        // Get stream id
        if (streamId === undefined) {
            streamId = this._activeStreamGuid;
        }
        // Get stream info
        const stream: IStreamInfo | undefined = this._streams.get(streamId);
        if (stream === undefined) {
            return;
        }
        stream.processor.reattach();
    }

    public rewriteStreamFileMap(streamId: string, map: IMapItem[]) {
        const stream: IStreamInfo | undefined = this._streams.get(streamId);
        if (stream === undefined) {
            return this._logger.warn(`Fail to update stream file map for stream "${streamId}" because stream doesn't exist.`);
        }
        stream.processor.rewriteStreamFileMap(map);
    }

    public pushToStreamFileMap(streamId: string, map: IMapItem[]) {
        const stream: IStreamInfo | undefined = this._streams.get(streamId);
        if (stream === undefined) {
            return this._logger.warn(`Fail to push stream file map for stream "${streamId}" because stream doesn't exist.`);
        }
        stream.processor.pushToStreamFileMap(map);
    }

    public addBoundFile(session: string, filename: string) {
        const stream: IStreamInfo | undefined = this._streams.get(session);
        if (stream === undefined) {
            return;
        }
        stream.bounds.push(filename);
        this._streams.set(session, stream);
    }

    public closeAll(): Promise<void> {
        return new Promise((resolve) => {
            // Destroy all connections / servers to UNIX sockets
            Promise.all(Array.from(this._streams.values()).map((stream: IStreamInfo) => {
                return this._destroyStream(stream.guid).catch((error: Error) => {
                    this._logger.error(`Fail destroy stream "${stream.guid}" due error: ${error.message}`);
                    return Promise.resolve();
                });
            })).then(() => {
                this._streams.clear();
                // Remove all UNIX socket's files
                this._cleanUp().then(() => {
                    resolve();
                }).catch((clearError: Error) => {
                    this._logger.warn(`Fail to cleanup sockets folder due error: ${clearError.message}`);
                    resolve();
                });
            });
        });
    }

    /**
     * Creates new stream socket
     * @returns Promise<IStreamInfo>
     */
    private _createStream(guid: string): Promise<IStreamInfo> {
        return new Promise((resolve, reject) => {
            const socketFile: string = this._getSocketFileName(`${Date.now()}-${guid}`);
            const streamFile: string = Path.resolve(ServiceUserPaths.getStreams(), `${Date.now()}-${guid}.stream`);
            const searchFile: string = Path.resolve(ServiceUserPaths.getStreams(), `${Date.now()}-${guid}.search`);
            try {
                // Create new server
                const server: Net.Server = Net.createServer(this._acceptConnectionToSocket.bind(this, guid));
                // Create stream state
                const events: EventsHub = new EventsHub(guid);
                // Create controllers
                const streamController: ControllerStreamProcessor   = new ControllerStreamProcessor(guid, streamFile, events);
                const searchController: ControllerStreamSearch      = new ControllerStreamSearch(guid, streamFile, searchFile, streamController, events);
                const chartsController: ControllerStreamCharts      = new ControllerStreamCharts(guid, streamFile, searchFile, streamController, events);
                const rangesController: ControllerStreamRanges      = new ControllerStreamRanges(guid, streamFile, streamController);
                const shellController: ControllerStreamShell        = new ControllerStreamShell(guid);
                // Create connection to trigger creation of server
                const stream: IStreamInfo = {
                    guid: guid,
                    socketFile: socketFile,
                    streamFile: streamFile,
                    searchFile: searchFile,
                    server: server,
                    connections: [],
                    bounds: [],
                    connectionFactory: (pluginName: string): Promise<{ socket: Net.Socket, file: string }> => {
                        return new Promise((resolveConnection) => {
                            const socket: Net.Socket = Net.connect(socketFile, () => {
                                this._logger.debug(`Created new connection UNIX socket: ${socketFile} for plugin "${pluginName}".`);
                                resolveConnection({ socket: socket, file: socketFile });
                            });
                            (socket as any).__id = Tools.guid();
                        });
                    },
                    events: events,
                    processor: streamController,
                    search: searchController,
                    charts: chartsController,
                    ranges: rangesController,
                    shell: shellController,
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
        this._logger.debug(`New connection to stream "${guid}" is accepted. Reference: ${pluginRef}`);
        stream.connections.push(socket);
    }

    private _destroyStream(guid: string): Promise<void> {
        return new Promise((resolve, reject) => {
            const stream: IStreamInfo | undefined = this._streams.get(guid);
            if (stream === undefined) {
                this._logger.warn(`Was gotten command to destroy stream, but stream wasn't found in storage.`);
                return;
            }
            const socketFile = stream.socketFile;
            const streamFile = stream.streamFile;
            const searchFile = stream.searchFile;
            stream.connections.forEach((connection: Net.Socket) => {
                connection.removeAllListeners();
                connection.unref();
                connection.destroy();
            });
            stream.server.unref();
            stream.connections = [];
            const destroyControllers = () => {
                return Promise.all([
                    stream.processor.destroy(),
                    stream.search.destroy(),
                    stream.ranges.destroy(),
                    stream.shell.destroy(),
                ]);
            };
            const unlinkFile = (file: string): Promise<void> => {
                return new Promise((resolveUnlink) => {
                    fs.exists(file, (exists: boolean) => {
                        if (!exists) {
                            this._logger.debug(`No need to remove file ${file} because it wasn't created.`);
                            return resolveUnlink();
                        }
                        fs.unlink(file, (removeSocketFileError: NodeJS.ErrnoException | null) => {
                            if (removeSocketFileError) {
                                this._logger.warn(`Fail to remove stream file ${file} due error: ${removeSocketFileError.message}`);
                            }
                            resolveUnlink();
                        });
                    });
                });
            };
            const unlinkStorageFiles = () => {
                return Promise.all([
                    unlinkFile(socketFile),
                    unlinkFile(streamFile),
                    unlinkFile(searchFile),
                ]);
            };
            // Destroy controllers
            destroyControllers().then(() => {
                this._logger.debug(`Controllers of stream "${guid}" are destroyed.`);
                unlinkStorageFiles().then(() => {
                    this._streams.delete(guid);
                    resolve();
                }).catch((unlinkError: Error) => {
                    this._streams.delete(guid);
                    this._logger.warn(`Fail to unlink stream files of stream "${guid}" due error: ${unlinkError.message}`);
                    reject(unlinkError);
                });
            }).catch((destroyControllersError: Error) => {
                this._logger.warn(`Fail to destroy controllers of stream "${guid}" due error: ${destroyControllersError.message}.`);
                reject(destroyControllersError);
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
                FS.readFolder(ServiceUserPaths.getSockets(), FS.EReadingFolderTarget.files),
                FS.readFolder(ServiceUserPaths.getStreams(), FS.EReadingFolderTarget.files),
            ]).then((result: [ string[], string[] ]) => {
                const files: string[] = [];
                const tm: number = Date.now();
                files.push(...result[0].map((file: string) => Path.resolve(ServiceUserPaths.getSockets(), file) ));
                files.push(...result[1].map((file: string) => Path.resolve(ServiceUserPaths.getStreams(), file) ));
                const queue: Array<Promise<void>> = files.map((file: string) => {
                    return new Promise((resolveUnlink) => {
                        fs.stat(file, (errStat: NodeJS.ErrnoException | null, stats: fs.Stats) => {
                            if (tm - stats.birthtimeMs < 60 * 1000 * 60 * 24) {
                                return resolveUnlink();
                            }
                            fs.unlink(file, (errorUnlink: NodeJS.ErrnoException | null) => {
                                if (errorUnlink) {
                                    this._logger.warn(`Fail to remove ${file} due error: ${errorUnlink.message}`);
                                }
                                // Resolve in anyway
                                resolveUnlink();
                            });
                        });
                    });
                });
                Promise.all(queue).then(() => {
                    resolve();
                }).catch(reject);
            }).catch((readingError: Error) => {
                this._logger.error(`Fail to read folder ${ServicePaths.getPlugins()} or ${ServiceUserPaths.getStreams()} due error: ${readingError.message}`);
                reject(readingError);
            });
        });
    }

    private _ipc_onStreamAdd(message: IPCElectronMessages.TMessage, response: (res: IPCElectronMessages.TMessage) => any) {
        if (!(message instanceof IPCElectronMessages.StreamAddRequest)) {
            return;
        }
        // Create stream
        this._createStream(message.guid).then((stream: IStreamInfo) => {
            // Check active
            if (this._activeStreamGuid === '') {
                this._activeStreamGuid = stream.guid;
            }
            // Prepare plugins
            ServicePlugins.addStream(stream.guid, stream.connectionFactory).then(() => {
                // Emit event
                this._subjects.onSessionCreated.emit({
                    stream: stream,
                });
                ServiceElectron.updateMenu();
                // Response
                response(new IPCElectronMessages.StreamAddResponse({
                    guid: message.guid,
                }));
            }).catch((pluginsError: Error) => {
                const errMsg: string = `Fail to create stream due error: ${pluginsError.message}`;
                // Response
                response(new IPCElectronMessages.StreamAddResponse({
                    guid: message.guid,
                    error: errMsg,
                }));
                this._logger.error(errMsg);
            });
        }).catch((streamCreateError: Error) => {
            const errMsg: string = `Fail to create stream due error: ${streamCreateError.message}`;
            // Response
            response(new IPCElectronMessages.StreamAddResponse({
                guid: message.guid,
                error: errMsg,
            }));
            this._logger.error(errMsg);
        });
    }

    private _ipc_onStreamRemoveRequest(message: IPCElectronMessages.TMessage, response: (message: IPCElectronMessages.TMessage) => void) {
        if (!(message instanceof IPCElectronMessages.StreamRemoveRequest)) {
            return;
        }
        this._destroyStream(message.guid).then(() => {
            ServicePlugins.removedStream(message.guid).then(() => {
                this._subjects.onSessionClosed.emit(message.guid);
                ServiceElectron.updateMenu();
                response(new IPCElectronMessages.StreamRemoveResponse({ guid: message.guid }));
            }).catch((plugingsError: Error) => {
                this._logger.error(`Fail to correctly destroy session "${message.guid}" due error: ${plugingsError.message}.`);
                response(new IPCElectronMessages.StreamRemoveResponse({ guid: message.guid, error: plugingsError.message }));
            });
        }).catch((destroyError: Error) => {
            this._logger.error(`Fail to correctly destroy session "${message.guid}" due error: ${destroyError.message}.`);
            response(new IPCElectronMessages.StreamRemoveResponse({ guid: message.guid, error: destroyError.message }));
        });
    }

    private _ipc_onStreamSetActive(message: IPCElectronMessages.TMessage) {
        if (!(message instanceof IPCElectronMessages.StreamSetActive)) {
            return;
        }
        if (this._activeStreamGuid === message.guid) {
            return;
        }
        this._activeStreamGuid = message.guid;
        this._subjects.onSessionChanged.emit(message.guid);
        ServiceElectron.updateMenu();
        this._logger.debug(`Active session is set to: ${this._activeStreamGuid}`);
    }

    private _ipc_onStreamReset(message: IPCElectronMessages.TMessage, response: (message: IPCElectronMessages.TMessage) => void) {
        if (!(message instanceof IPCElectronMessages.StreamResetRequest)) {
            return;
        }
        const stream: IStreamInfo | undefined = this._streams.get(message.guid);
        if (stream === undefined) {
            return this._logger.warn(`Fail to find a stream data for stream guid "${message.guid}"`);
        }
        Promise.all([
            stream.processor.reset(),
            stream.search.reset(),
        ]).then(() => {
            this._logger.debug(`Session "${message.guid}" was reset.`);
            response(new IPCElectronMessages.StreamResetResponse({
                guid: message.guid,
            }));
        }).catch((error: Error) => {
            response(new IPCElectronMessages.StreamResetResponse({
                guid: message.guid,
                error: this._logger.warn(`Fail to reset session "${message.guid}" due error: ${error.message}.`),
            }));
        });
    }

    private _stream_onData(guid: string, ref: string, chunk: Buffer) {
        // Get stream info
        const stream: IStreamInfo | undefined = this._streams.get(guid);
        if (stream === undefined) {
            return this._logger.warn(`Fail to find a stream data for stream guid "${guid}"`);
        }
        stream.processor.write(chunk, ref, undefined).then(() => {
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
            return Path.resolve(ServiceUserPaths.getSockets(), `${base}.sock`);
        }
    }

}

export default (new ServiceStreams());
