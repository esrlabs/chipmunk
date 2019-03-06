import * as Path from 'path';
import * as fs from 'fs';
import * as Net from 'net';
import * as FS from '../../platform/node/src/fs';
import { EventEmitter } from 'events';

import ServicePaths from './service.paths';
import ServiceElectron, { IPCMessages as IPCElectronMessages, Subscription } from './service.electron';
import ServicePlugins from './service.plugins';
import Logger from '../../platform/node/src/env.logger';

import { IService } from '../interfaces/interface.service';

export interface IStreamInfo {
    guid: string;
    file: string;
    socket: Net.Socket;
    server: Net.Server;
    connection: Net.Socket;
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

    constructor() {
        super();
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
                stream.server.unref();
                stream.connection.unref();
                stream.connection.destroy();
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
            const socketFile: string = Path.resolve(ServicePaths.getSockets(), `${Date.now()}-${guid}.sock`);
            try {
                // Create new server
                const server: Net.Server = Net.createServer((socket: Net.Socket) => {
                    const stream: IStreamInfo = {
                        guid: guid,
                        file: socketFile,
                        server: server,
                        socket: socket,
                        connection: connection,
                    };
                    this._streams.set(guid, stream);
                    resolve(stream);
                });
                // Bind server with file
                server.listen(socketFile);
                // Create connection to trigger creation of server
                const connection = Net.connect(socketFile, () => {
                    this._logger.env(`Created new UNIX socket: ${socketFile}.`);
                });
            } catch (e) {
                reject(e);
            }
        });
    }

    private _destroyStream(guid: string): Promise<void> {
        return new Promise((resolve) => {
            const stream: IStreamInfo | undefined = this._streams.get(guid);
            if (stream === undefined) {
                this._logger.warn(`Was gotten command to destroy stream, but stream wasn't found in storage.`);
                return;
            }
            const streamSocketFile = stream.file;
            stream.server.unref();
            stream.connection.removeAllListeners();
            stream.connection.unref();
            stream.connection.destroy();
            this._streams.delete(guid);
            fs.unlink(streamSocketFile, (removeFileError: NodeJS.ErrnoException) => {
                if (removeFileError) {
                    this._logger.warn(`Fail to remove stream socket file ${streamSocketFile} due error: ${removeFileError.message}`);
                }
                // Resolve in any case
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
            FS.readFolder(ServicePaths.getSockets(), FS.EReadingFolderTarget.files).then((files: string[]) => {
                const queue: Array<Promise<void>> = files.map((file: string) => {
                    return new Promise((resolveUnlink) => {
                        const socket: string = Path.resolve(ServicePaths.getSockets(), file);
                        fs.unlink(socket, (errorUnlink: NodeJS.ErrnoException) => {
                            if (errorUnlink) {
                                this._logger.warn(`Fail to remove ${socket} due error: ${errorUnlink.message}`);
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
                this._logger.error(`Fail to read socket folder (${ServicePaths.getPlugins()}) due error: ${readingError.message}`);
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
            stream.connection.on('data', this._stream_onData.bind(this, message.guid));
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

    private _stream_onData(guid: string, chunk: Buffer) {
        // Exclude plugin id
        const pluginId: number = chunk.readInt16BE(0);
        // Get token
        const pluginToken: string | undefined = ServicePlugins.getPluginToken(pluginId);
        if (pluginToken === undefined) {
            return this._logger.warn(`Fail to find plugin token by ID of plugin: id = "${pluginId}". Chunk of data will not be forward.`);
        }
        // Remove plugin ID from chunk
        const cleared: Buffer = chunk.slice(2);
        const output = cleared.toString('utf8');
        console.log(output);
        // Send data forward
        ServiceElectron.IPC.send(new IPCElectronMessages.StreamData({
            guid: guid,
            data: output,
            pluginId: pluginId,
            pluginToken: pluginToken,
        })).catch((error: Error) => {
            this._logger.warn(`Fail send data from stream to render process due error: ${error.message}`);
        });
    }

}

export default (new ServiceStreams());
