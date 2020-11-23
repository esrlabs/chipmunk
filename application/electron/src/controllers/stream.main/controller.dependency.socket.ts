
import * as Net from 'net';
import * as Tools from '../../tools/index';

import Logger from '../../tools/env.logger';

import { Session } from "indexer-neon";
import { Dependency } from './controller.dependency';

const CConnectionTimeout = 5 * 1000;

export class Socket extends Dependency{

    private readonly _session: Session;
    private readonly _logger: Logger;
    private _socket: Net.Socket | undefined;

    constructor(session: Session) {
        super();
        this._logger = new Logger(`${this.getName()}: ${session.getUUID()}`)
        this._session = session;
    }

    public destroy(): Promise<void> {
        return new Promise((resolve, reject) => {
            this._disconnect();
            resolve();
        });
    }

    public init(): Promise<void> {
        return new Promise((resolve, reject) => {
            const path: string | Error = this._session.getSocketPath();
            if (path instanceof Error) {
                return reject(path);
            }
            this._connect(path).then((socket: Net.Socket) => {
                this._socket = socket;
                this._logger.debug(`Created new connection socket: ${path} for session "${this._session.getUUID()}".`);
                resolve();
            }).catch((err: Error) => {
                this._logger.error(`Fail to connect to socket: ${path} for session "${this._session.getUUID()}" due error: ${err.message}.`);
                reject(err);
            });
        });
    }

    public getName(): string {
        return 'Socket';
    }

    private _connect(path: string): Promise<Net.Socket> {
        return new Promise((resolve, reject) => {
            if (this._socket !== undefined) {
                return reject(new Error(`Connection is already created.`));
            }
            const socket = Net.connect(path, () => {
                clearTimeout(timeout);
                this._logger.debug(`Created new connection socket: ${path} for session "${this._session.getUUID()}".`);
                resolve(socket);
            });
            socket.on('error', (err: Error) => {
                this._logger.error(`Error on socket connection: ${err.message}`);
            });
            socket.on('close', () => {
                this._logger.debug(`Connection is closed.`);
                this._disconnect();
            });
            const timeout: any = setTimeout(() => {
                socket.removeAllListeners();
                socket.destroy();
                reject(new Error(this._logger.error(`Fail to connect due timeout ${CConnectionTimeout / 1000} s`)));
            }, CConnectionTimeout);
        });
    }


    private _disconnect() {
        if (this._socket === undefined) {
            return;
        }
        this._socket.destroy();
        this._socket.removeAllListeners();
        this._socket = undefined;
    }

}