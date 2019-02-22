import * as Path from 'path';
import * as fs from 'fs';
import * as Net from 'net';
import * as FS from '../../platform/node/src/fs';

import ServicePaths from './service.paths';
import ServiceElectron, { IPCMessages as IPCElectronMessages, Subscription } from './service.electron';

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

class ServiceStreams implements IService {

    private _logger: Logger = new Logger('ServiceStreams');
    private _streams: Map<TGuid, IStreamInfo> = new Map();
    private _subscriptions: { [key: string ]: Subscription | undefined } = { };

    constructor() {
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
     * @returns Promise<void>
     */
    public create(guid: string): Promise<IStreamInfo> {
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
    }

    private _ipc_onStreamRemove(message: IPCElectronMessages.TMessage) {
        if (!(message instanceof IPCElectronMessages.StreamRemove)) {
            return;
        }
    }

}

export default (new ServiceStreams());
