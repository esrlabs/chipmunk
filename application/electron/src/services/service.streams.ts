import * as Path from 'path';
import * as fs from 'fs';
import * as Net from 'net';
import * as FS from '../../platform/node/src/fs';
import { EventEmitter } from 'events';

import ServicePaths from './service.paths';
import ServiceElectron, { IPCMessages as IPCElectronMessages, Subscription } from './service.electron';
import ServicePlugins from './service.plugins';
import Logger from '../../platform/node/src/env.logger';
import ControllerStreamSearch, { IResults } from '../controllers/controller.stream.search';
import { IService } from '../interfaces/interface.service';
import * as Tools from '../../platform/cross/src/index';

export interface IStreamInfo {
    guid: string;
    socketFile: string;
    streamFile: string;
    connections: Net.Socket[];
    connectionFactory: (pluginName: string) => Promise<Net.Socket>;
    server: Net.Server;
    fileWriteStream: fs.WriteStream;
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
    private _subscriptions: { [key: string ]: Subscription | undefined } = { };
    private _pluginRefs: Map<string, number> = new Map();

    constructor() {
        super();
        this._ipc_onStreamAdd = this._ipc_onStreamAdd.bind(this);
        this._ipc_onStreamRemove = this._ipc_onStreamRemove.bind(this);
        this._ipc_onSearchRequest = this._ipc_onSearchRequest.bind(this);
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
            ServiceElectron.IPC.subscribe(IPCElectronMessages.SearchRequest, this._ipc_onSearchRequest).then((subscription: Subscription) => {
                this._subscriptions.searchRequest = subscription;
            }).catch((error: Error) => {
                this._logger.warn(`Fail to subscribe to render event "SearchRequest" due error: ${error.message}. This is not blocked error, loading will be continued.`);
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
                stream.fileWriteStream.close();
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

    /**
     * Creates new stream socket
     * @returns Promise<IStreamInfo>
     */
    private _createStream(guid: string): Promise<IStreamInfo> {
        return new Promise((resolve, reject) => {
            // const socketFile: string = Path.resolve(ServicePaths.getSockets(), `test.sock`);
            const socketFile: string = Path.resolve(ServicePaths.getSockets(), `${Date.now()}-${guid}.sock`);
            const streamFile: string = Path.resolve(ServicePaths.getStreams(), `${Date.now()}-${guid}.stream`);
            try {
                // Create new server
                const server: Net.Server = Net.createServer(this._acceptConnectionToSocket.bind(this, guid));
                // Create connection to trigger creation of server
                const stream: IStreamInfo = {
                    guid: guid,
                    socketFile: socketFile,
                    streamFile: streamFile,
                    server: server,
                    connections: [],
                    fileWriteStream: fs.createWriteStream(streamFile),
                    connectionFactory: (pluginName: string) => {
                        return new Promise((resolveConnection) => {
                            const sharedConnection: Net.Socket = Net.connect(socketFile, () => {
                                this._logger.env(`Created new connection UNIX socket: ${socketFile} for plugin "${pluginName}".`);
                                resolveConnection(sharedConnection);
                            });
                            (sharedConnection as any).__id = Tools.guid();
                        });
                    },
                };
                // Bind server with file
                server.listen(socketFile);
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
        this._logger.env(`New connection to stream "${guid}" is accepted.`);
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
            stream.fileWriteStream.close();
            this._streams.delete(guid);
            Promise.all([
                new Promise((resolveUnlink) => {
                    fs.unlink(socketFile, (removeSocketFileError: NodeJS.ErrnoException) => {
                        if (removeSocketFileError) {
                            this._logger.warn(`Fail to remove stream socket file ${socketFile} due error: ${removeSocketFileError.message}`);
                        }
                        resolveUnlink();
                    });
                }),
                new Promise((resolveUnlink) => {
                    fs.unlink(streamFile, (removeStreamFileError: NodeJS.ErrnoException) => {
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
                        fs.unlink(file, (errorUnlink: NodeJS.ErrnoException) => {
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

    private _stream_onData(guid: string, ref: string, chunk: Buffer) {
        // Get stream info
        const stream: IStreamInfo | undefined = this._streams.get(guid);
        if (stream === undefined) {
            return this._logger.warn(`Fail to find a stream data for stream guid "${guid}"`);
        }
        const output = chunk.toString('utf8');
        // Binding ref with ID of plugin
        if (this._bindPluginRefWithPluginToken(output, ref) === true) {
            // This is binding message. No need to process it forward.
            return;
        }
        // Attempt to find ID of plugin
        const pluginId: number | undefined = this._pluginRefs.get(ref);
        if (pluginId === undefined) {
            return this._logger.warn(`Fail to find plugin ID. Chunk of data will not be forward.`);
        }
        // Get token
        const pluginToken: string | undefined = ServicePlugins.getPluginToken(pluginId);
        if (pluginToken === undefined) {
            return this._logger.warn(`Fail to find plugin token by ID of plugin: id = "${pluginId}". Chunk of data will not be forward.`);
        }
        // Send data forward
        ServiceElectron.IPC.send(new IPCElectronMessages.StreamData({
            guid: guid,
            data: output,
            pluginId: pluginId,
            pluginToken: pluginToken,
        })).catch((error: Error) => {
            this._logger.warn(`Fail send data from stream to render process due error: ${error.message}`);
        });
        // Write data to stream file
        stream.fileWriteStream.write(chunk, (writeError: Error | null | undefined) => {
            if (writeError) {
                this._logger.error(`Fail to write data into stream file (${stream.streamFile}) due error: ${writeError.message}`);
            }
        });
    }

    private _bindPluginRefWithPluginToken(chunk: string, ref: string): boolean {
        if (this._pluginRefs.has(ref)) {
            // Plugin's connection is already bound
            return false;
        }
        if (chunk.search(/\[plugin:\d*\]/) === -1) {
            return false;
        }
        const id: number = parseInt(chunk.replace('[plugin:', '').replace(']', ''), 10);
        const pluginToken: string | undefined = ServicePlugins.getPluginToken(id);
        if (pluginToken === undefined) {
            this._logger.warn(`Fail to find plugin token by ID of plugin: id = "${id}". Attempt auth of plugin connection is failed.`);
            return false;
        }
        // Bind plugin ref with plugin ID
        this._pluginRefs.set(ref, id);
        return true;
    }

    private _ipc_onSearchRequest(message: any, response: (instance: any) => any) {
        const done = (error?: string) => {
            ServiceElectron.IPC.send(new IPCElectronMessages.SearchRequestFinished({
                streamId: message.streamId,
                requestId: message.requestId,
                error: error,
                duration: Date.now() - started,
            }));
        };
        const stream: IStreamInfo | undefined = this._streams.get(message.streamId);
        if (stream === undefined) {
            // TODO: response with error;
            return this._logger.warn(`Search request came for stream "${message.streamId}", but stream isn't found.`);
        }
        // Notify render: search is started
        ServiceElectron.IPC.send(new IPCElectronMessages.SearchRequestStarted({
            streamId: message.streamId,
            requestId: message.requestId,
        }));
        // Create regexps
        const requests: RegExp[] = message.requests.map((regInfo: IPCElectronMessages.IRegExpStr) => {
            return new RegExp(regInfo.source, regInfo.flags);
        });
        // Create search controller, which: will read target file and make search
        const search: ControllerStreamSearch = new ControllerStreamSearch(stream.streamFile, requests);
        // Fix time of starting
        const started: number = Date.now();
        // Listen "middle" results
        search.on(ControllerStreamSearch.Events.next, (middleResults: IResults) => {
            // Send to render "middle" results
            ServiceElectron.IPC.send(new IPCElectronMessages.SearchRequestResults({
                streamId: message.streamId,
                requestId: message.requestId,
                results: middleResults.regs,
            }));
        });
        // Start searching
        search.search().then((fullResults: IResults) => {
            // Nothing to do with full results, because everything was sent during search
            done();
        }).catch((error: Error) => {
            done(error.message);
        });
    }

}

export default (new ServiceStreams());
