import { ControllerSerialPort, IOptions, IIOState } from '../controllers/controller.serialport';
import * as SerialPort from 'serialport';
import Logger from '../env/env.logger';
import PluginIPCService from 'chipmunk.plugin.ipc';
import { IPCMessages } from 'chipmunk.plugin.ipc';
import { ERenderEvents } from '../consts/events';

export interface IListeners {
    onData: (chunk: Buffer) => void;
    onError: (error: Error) => void;
    onDisconnect: () => void;
}

export interface IPortInfo {
    path: string;
    manufacturer?: string;
    serialNumber?: string;
    pnpId?: string;
    locationId?: string;
    productId?: string;
    vendorId?: string;
}

export interface IPortState {
    ioState: IIOState;
    connections: number;
}

class ServicePorts {

    private _controllers: Map<string, ControllerSerialPort> = new Map();
    private _listeners: Map<string, Map<string, IListeners>> = new Map();
    private _logger: Logger = new Logger('ControllerSerialPortManager');
    private _token: string | undefined;
    private _connectedPortsState: {
        timer: any,
        attempts: number,
        state: { [key: string]: IPortState }
    } = {
        timer: -1,
        attempts: 0,
        state: {}
    };

    constructor() {

    }

    public destroy(): Promise<void> {
        return new Promise((resolve) => {
            this._listeners.clear();
            Promise.all(Array.from(this._controllers.keys()).map((port: string) => {
                return this._close(port);
            })).then(() => {
                this._controllers.clear();
                resolve();
            });
        });
    }

    public refPort(session: string, options: IOptions, listeners: IListeners): Promise<void> {
        return new Promise((resolve, reject) => {
            if (typeof options !== 'object' || options === null) {
                return reject(new Error(this._logger.error(`Fail to get port controller because options isn't ann object`)));
            }
            if (typeof options.path !== 'string' || options.path.trim() === '') {
                return reject(new Error(this._logger.error(`Fail to get port controller because "path" is incorrect: ${options.path}`)));
            }
            let controller: ControllerSerialPort | undefined = this._controllers.get(options.path);
            if (controller !== undefined) {
                this._refPortListeners(session, options.path, listeners).then(resolve);
                return;
            }
            controller = new ControllerSerialPort(options);
            controller.open().then(() => {
                if (controller === undefined) {
                    return;
                }
                controller.on(ControllerSerialPort.Events.data, this._onData.bind(this, options.path));
                controller.on(ControllerSerialPort.Events.error, this._onError.bind(this, options.path));
                controller.on(ControllerSerialPort.Events.disconnect, this._onDisconnect.bind(this, options.path));
                this._controllers.set(options.path, controller);
                this._refPortListeners(session, options.path, listeners).then(resolve);                
            }).catch((error: Error) => {
                reject(new Error(this._logger.error(`Fail to create port's controller due error: ${error.message}`)));
            });
        });
    }

    public unrefPort(session: string, port: string): Promise<void> {
        return this._unrefPortListeners(session, port);
    }

    public write(port: string, chunk: Buffer | string): Promise<void> {
        return new Promise((resolve, reject) => {
            let controller: ControllerSerialPort | undefined = this._controllers.get(port);
            if (controller === undefined) {
                return reject(new Error(this._logger.error(`Fail to write into port, because controller of port "${port}" isn't created.`)));
            }
            controller.write(chunk).then(resolve).catch(reject);
        });
    }

    public getList(): Promise<IPortInfo[]> {
        return new Promise((resolve, reject) => {
            SerialPort.list().then((ports: SerialPort.PortInfo[]) => {
                const portsU = ports as unknown;
                const portsI: IPortInfo[] = portsU as IPortInfo[];
                resolve(portsI.map((port: IPortInfo) => {
                    return Object.assign({ }, port);
                }));
            }).catch((error: Error | null | undefined) => {
                if (error) {
                    reject(new Error(this._logger.error(`Fail to get list of ports due error: ${error.message}`)));
                }
                reject(new Error(this._logger.error(`Fail to get list of ports because unknown error`)));
            });
        });
    }

    public create(path: string) {
        const SerialPortNamespace = require('@serialport/stream');
        const MockBinding = require('@serialport/binding-mock');
        SerialPortNamespace.Binding = MockBinding;
        MockBinding.createPort(path, { echo: true, record: true });
    }

    public setToken(token: string) {
        this._token = token;
    }

    private _close(port: string): Promise<void> {
        return new Promise((resolve, reject) => {
            let controller: ControllerSerialPort | undefined = this._controllers.get(port);
            if (controller === undefined) {
                return resolve();
            }
            controller.destroy().catch((error: Error) => {
                this._logger.error(`Error on destroy port "${port}": ${error.message}`);
            }).finally(() => {
                this._controllers.delete(port);
                resolve();
            });
        });
    }

    private _refPortListeners(session: string, port: string, listeners: IListeners): Promise<void> {
        return new Promise((resolve) => {
            let stored: Map<string, IListeners> | undefined = this._listeners.get(port);
            if (stored === undefined) {
                stored = new Map();
            }
            stored.set(session, listeners);
            this._listeners.set(port, stored);
            this._updateConnectedPortsState();
            this._updateControllerSignatureState(session);
            resolve();
        });
    }

    private _unrefPortListeners(session: string, port: string): Promise<void> {
        return new Promise((resolve) => {
            let stored: Map<string, IListeners> | undefined = this._listeners.get(port);
            if (stored === undefined) {
                return resolve();
            }
            stored.delete(session);
            if (stored.size === 0) {
                // Nobody listen port anymore. Can be removed.
                this._listeners.delete(port);
                return this._close(port).then(() => {
                    this._updateConnectedPortsState();
                    this._updateControllerSignatureState(session);
                    resolve();
                });
            }
            this._listeners.set(port, stored);
            this._updateControllerSignatureState(session);
            this._updateConnectedPortsState();
            resolve();
        });
    }

    private _unrefPortAllListeners(port: string): Promise<void> {
        return new Promise((resolve) => {
            let stored: Map<string, IListeners> | undefined = this._listeners.get(port);
            this._listeners.delete(port);
            this._close(port).then(() => {
                this._updateConnectedPortsState();
                if (stored !== undefined) {
                    Array.from(stored.keys()).forEach((session: string) => {
                        this._updateControllerSignatureState(session);
                    });
                }
                resolve();
            });
        });
    }

    private _onData(port: string, chunk: Buffer) {
        const listeners: Map<string, IListeners> | undefined = this._listeners.get(port);
        if (listeners === undefined) {
            return;
        }
        listeners.forEach((listeners: IListeners) => {
            listeners.onData(chunk);
        });
        this._updateConnectedPortsState();
    }

    private _onError(port: string, error: Error) {
        const listeners: Map<string, IListeners> | undefined = this._listeners.get(port);
        if (listeners === undefined) {
            return;
        }
        listeners.forEach((listeners: IListeners) => {
            listeners.onError(error);
        });
        this._unrefPortAllListeners(port);
    }

    private _onDisconnect(port: string) {
        const listeners: Map<string, IListeners> | undefined = this._listeners.get(port);
        if (listeners === undefined) {
            return;
        }
        listeners.forEach((listeners: IListeners) => {
            listeners.onDisconnect();
        });
        this._unrefPortAllListeners(port);
    }

    private _getConnectionsCount(port: string) {
        const listeners: Map<string, IListeners> | undefined = this._listeners.get(port);
        if (listeners === undefined) {
            return 0;
        }
        return listeners.size;
    }

    private _updateConnectedPortsState() {
        clearTimeout(this._connectedPortsState.timer);
        this._connectedPortsState.state = {};
        this._controllers.forEach((controller: ControllerSerialPort) => {
            this._connectedPortsState.state[controller.getPath()] = {
                connections: this._getConnectionsCount(controller.getPath()),
                ioState: controller.getIOState()
            };
        });
        if (Object.keys(this._connectedPortsState.state).length === 0) {
            return;
        }
        if (this._connectedPortsState.attempts < 10) {
            this._connectedPortsState.attempts += 1;
            this._connectedPortsState.timer = setTimeout(() => {
                this._sendConnectedPortsState();
            }, 250);
        } else {
            this._sendConnectedPortsState();
        }
    }

    private _updateControllerSignatureState(session: string) {
        const ports: string[] = [];
        this._listeners.forEach((listeners: Map<string, IListeners>, port: string) => {
            if (listeners.has(session)) {
                ports.push(port);
            }
        });
        ports.forEach((port: string) => {
            let controller: ControllerSerialPort | undefined = this._controllers.get(port);
            if (controller === undefined) {
                return;
            }
            controller.setSignature(ports.length > 1 ? true : false);
        });
    }

    private _sendConnectedPortsState() {
        if (typeof this._token !== 'string') {
            return;
        }
        this._connectedPortsState.attempts = 0;
        PluginIPCService.sendToPluginHost('*', {
            event: ERenderEvents.state,
            streamId: '*',
            token: this._token,
            state: this._connectedPortsState.state
        });
    }
}

export default new ServicePorts();
