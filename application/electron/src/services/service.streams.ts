import * as OS from 'os';
import * as Path from 'path';
import * as fs from 'fs';
import * as Net from 'net';
import * as FS from '../../platform/node/src/fs';

import ServicePaths from './service.paths';
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
    /**
     * Initialization function
     * @returns Promise<void>
     */
    public init(): Promise<void> {
        return new Promise((resolve, reject) => {
            this._cleanUp().then(resolve).catch(reject);
        });
    }

    public getName(): string {
        return 'ServiceStreams';
    }

    /**
     * Creates new stream socket
     * @returns Promise<void>
     */
    public create(guid: string): Promise<Net.Socket> {
        return new Promise((resolve, reject) => {
            const socketFile: string = Path.resolve(ServicePaths.getSockets(), `${Date.now()}-${guid}.sock`);
            try {
                // Create new server
                const server: Net.Server = Net.createServer((socket: Net.Socket) => {
                    this._streams.set(guid, {
                        guid: guid,
                        file: socketFile,
                        server: server,
                        socket: socket,
                        connection: connection,
                    });
                    resolve(socket);
                });
                // Bind server with file
                server.listen(socketFile);
                // Create connection to trigger creation of server
                const connection = Net.connect(socketFile, () => {
                    console.log('connected');
                });
                connection.on('data', (chunk: any) => {
                    console.log('!!!!!!' + chunk.toString() + '!!!!!!');
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

}

export default (new ServiceStreams());
