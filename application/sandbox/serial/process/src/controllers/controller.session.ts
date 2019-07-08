import Logger from '../env/env.logger';
import { IOptions } from './controller.serialport';
import ServicePorts from '../services/service.ports';
import PluginIPCService from 'logviewer.plugin.ipc';
import { ERenderEvents } from '../consts/events';

export interface IPortChunk {
    chunk: string;
    port: string;
}

export interface IPortError {
    error: Error;
    port: string;
}

export class ControllerSession {

    private _session: string;
    private _ports: string[] = [];
    private _logger: Logger;

    constructor(session: string) {
        this._session = session;
        this._logger = new Logger(`ControllerSession: ${session}`);
    }

    public destroy(): Promise<void> {
        return new Promise((resolve) => {
            if (this._ports.length === 0) {
                return resolve();
            }
            Promise.all(this._ports.map((port: string) => {
                return new Promise((resolveUnrefPort) => {
                    ServicePorts.unrefPort(this._session, port).catch((errorUnrefPort: Error) => {
                        this._logger.error(`Error while unrefing port: ${errorUnrefPort.message}`);
                    }).finally(() => {
                        resolveUnrefPort();
                    });
                });
            })).then(() => {
                resolve();
            });
        });
    }

    public open(options: IOptions): Promise<void> {
        return new Promise((resolve, reject) => {
            if (typeof options !== 'object' || options === null) {
                return reject(new Error(this._logger.error(`Options should be object. Gotten type: "${typeof options}"`)));
            }
            if (typeof options.path !== 'string' || options.path.trim() === '') {
                return reject(new Error(this._logger.error(`Wrong "path" defition`)));
            }
            if (this._isPortRefed(options.path)) {
                return reject(new Error(this._logger.error(`Port "${options.path}" is already assigned with session "${this._session}"`)));
            }
            ServicePorts.refPort(this._session, options, {
                onData: this._onPortData.bind(this, options.path),
                onError: this._onPortError.bind(this, options.path),
                onDisconnect: this._onPortDisconnect.bind(this, options.path)
            }).then(() => {
                this._logger.env(`Port "${options.path}" is assigned with session "${this._session}"`);
                // Save data
                this._ports.push(options.path);
                // Notify render
                PluginIPCService.sendToPluginHost(this._session, {
                    event: ERenderEvents.connected,
                    streamId: this._session,
                    port: options.path,
                });
                resolve();
            }).catch((openErr: Error) => {
                reject(new Error(this._logger.error(`Fail to open port "${options.path}" due error: ${openErr.message}`)));
            });
        });
    }

    public close(path: string): Promise<void> {
        return new Promise((resolve, reject) => {
            if (!this._isPortRefed(path)) {
                return reject(new Error(this._logger.error(`Port "${path}" isn't assigned with session "${this._session}"`)));
            }
            ServicePorts.unrefPort(this._session, path).catch((error: Error) => {
                this._logger.error(`Fail unref normally port "${path}" from session "${this._session}" due error: ${error.message}`);
            }).finally(() => {
                this._removePort(path);
                resolve();
            })
        });
    }

    private _onPortData(port: string, chunk: Buffer) {
        PluginIPCService.sendToStream(chunk, this._session);
    }

    private _onPortError(port: string, error: Error) {
        PluginIPCService.sendToPluginHost(this._session, {
            event: ERenderEvents.error,
            streamId: this._session,
            error: error.message,
            port: port,
        });
        this._logger.error(`Port "${port}" return error: ${error.message}`);
        // We can remove port, because on error it will be destroyed
        this._removePort(port);
    }

    private _onPortDisconnect(port: string) {
        PluginIPCService.sendToPluginHost(this._session, {
            event: ERenderEvents.disconnected,
            streamId: this._session,
            port: port,
        });
        this._logger.error(`Port "${port}" is disconnected`);
        // We can remove port, because on disconnect it will be destroyed
        this._removePort(port);
    }

    private _removePort(port: string) {
        const index: number = this._ports.indexOf(port);
        if (index === -1) {
            return;
        }
        this._ports.splice(index, 1);
    }

    private _isPortRefed(port: string): boolean {
        return this._ports.indexOf(port) !== -1;
    }

}