import * as Net from 'net';
import * as IPCPluginMessages from '../../../../common/ipc/plugins.ipc.messages/index';

import { ChildProcess, fork } from 'child_process';
import { Emitter, Subscription } from '../../tools/index';
import { CStdoutSocketAliases } from '../../consts/controller.plugin.process';

import Logger from '../../tools/env.logger';
import ControllerIPCPlugin from './plugin.process.ipc';
import ServiceProduction from '../../services/service.production';
import ServicePaths from '../../services/service.paths';

const CDebugPluginPorts: { [key: string]: number } = {
    serial: 9240,
    processes: 9241,
};

const CSettings = {
    resolverTimeout: 3000,
};

interface IConnection {
    socket: Net.Socket;
    file: string;
}

interface IOpt {
    id: number;
    name: string;
    entrypoint: string;
    token: string;
}

/**
 * @class ControllerPluginProcessSingle
 * @description Execute plugin node process and provide access to it
 */

export default class ControllerPluginProcessSingle extends Emitter {

    public static Events = {
        close: Symbol(),
        disconnect: Symbol(),
        error: Symbol(),
        output: Symbol(),
    };

    private _logger: Logger;
    private _opt: IOpt;
    private _process: ChildProcess | undefined;
    private _ipc: ControllerIPCPlugin | undefined;
    private _connections: Map<string, IConnection> = new Map();
    private _subscriptions: { [key: string]: Subscription } = {};
    private _resolvers: {
        bind: Map<string, () => void>,
        unbind: Map<string, () => void>,
    } = {
        bind: new Map(),
        unbind: new Map(),
    };

    constructor(opt: IOpt) {
        super();
        this._opt = opt;
        this._logger = new Logger(`plugin: ${this._opt.name}`);
        this._onSTDData = this._onSTDData.bind(this);
        this._onClose = this._onClose.bind(this);
        this._onError = this._onError.bind(this);
        this._onDisconnect = this._onDisconnect.bind(this);
    }

    /**
     * Attempt to fork plugin process
     * @returns { Promise<void> }
     */
    public attach(): Promise<void> {
        return new Promise((resolve, reject) => {
            const args: string[] = [
                `--chipmunk-settingspath=${ServicePaths.getPluginsCfgFolder()}`,
                `--chipmunk-plugin-alias=${this._opt.name.replace(/[^\d\w-_]/gi, '_')}`,
            ];
            if (!ServiceProduction.isProduction()) {
                args.push(`--inspect=127.0.0.1:${CDebugPluginPorts[this._opt.name] === undefined ? (9300 + this._opt.id - 1) : CDebugPluginPorts[this._opt.name]}`);
            }
            this._process = fork(
                this._opt.entrypoint,
                args,
                { stdio: [
                    'pipe', // stdin  - doesn't used by parent process
                    'pipe', // stdout - listened by parent process. Whole output from it goes to logs of parent process
                    'pipe', // stderr - listened by parent process. Whole output from it goes to logs of parent process
                    'ipc',  // ipc    - used by parent process as command sender / reciever
                ]});
            // Getting data events
            this._process.stderr.on('data', this._onSTDData);
            this._process.stdout.on('data', this._onSTDData);
            // State process events
            this._process.on('exit', this._onClose);
            this._process.on('close', this._onClose);
            this._process.on('error', this._onError);
            this._process.on('disconnect', this._onDisconnect);
            // Create IPC controller
            this._ipc = new ControllerIPCPlugin(this._opt.name, this._process, this._opt.token);
            // Send token
            this._ipc.send(new IPCPluginMessages.PluginToken({
                token: this._opt.token,
                id: this._opt.id,
            })).catch((sendingError: Error) => {
                this._logger.error(`Fail delivery plugin token due error: ${sendingError.message}`);
            });
            Promise.all([
                this._ipc.subscribe(IPCPluginMessages.SessionStreamBound, this._onSessionStreamBound.bind(this)).then((subscription: Subscription) => {
                    this._subscriptions.SessionStreamBound = subscription;
                }),
                this._ipc.subscribe(IPCPluginMessages.SessionStreamUnbound, this._onSessionStreamUnbound.bind(this)).then((subscription: Subscription) => {
                    this._subscriptions.SessionStreamUnbound = subscription;
                }),
            ]).then(() => {
                resolve();
            }).catch((error: Error) => {
                const err: string = `Fail to subscribe to plugin's IPC events due error: ${error.message}`;
                this._logger.warn(err);
                reject(new Error(err));
            });
        });
    }

    /**
     * Returns IPC controller of plugin
     * @returns { Promise<void> }
     */
    public getIPC(): ControllerIPCPlugin | Error {
        if (this._ipc === undefined) {
            return new Error(`IPC controller isn't initialized.`);
        }
        return this._ipc;
    }

    /**
     * Attempt to kill plugin process
     * @returns void
     */
    public kill(signal: string = 'SIGTERM'): boolean {
        if (this._process === undefined || this._ipc === undefined) {
            return false;
        }
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].destroy();
        });
        this._ipc.destroy();
        if (!this._process.killed) {
            this._process.kill(signal);
        }
        this._process = undefined;
        this._connections.clear();
        return true;
    }

    public bindStream(guid: string, connection: IConnection): Promise<void> {
        return new Promise((resolve, reject) => {
            if (this._process === undefined) {
                return reject(new Error(this._logger.warn(`Attempt to bind stream to plugin, which doesn't attached. Stream GUID: ${guid}.`)));
            }
            if (this._connections.has(guid)) {
                return reject(new Error(this._logger.warn(`Plugin process is already bound with stream "${guid}"`)));
            }
            this._logger.debug(`Sent information about stream GUID: ${guid}.`);
            // Bind socket
            this._bindRefWithId(connection.socket).then(() => {
                if (this._process === undefined) {
                    return reject(new Error(this._logger.warn(`Fail to bind stream to plugin, which doesn't attached. Stream GUID: ${guid}.`)));
                }
                this._connections.set(guid, connection);
                // Send socket to plugin process
                if (process.platform === 'win32') {
                    // Passing sockets is not supported on Windows.
                    this._process.send(`${CStdoutSocketAliases.bind}${guid};${connection.file}`);
                } else {
                    // On all other platforms we can pass socket
                    this._process.send(`${CStdoutSocketAliases.bind}${guid};${connection.file}`, connection.socket);
                }
                this._setBindResolver(guid, resolve);
            }).catch(reject);
        });
    }

    public unbindStream(guid: string): Promise<void> {
        return new Promise((resolve) => {
            if (this._process === undefined) {
                this._logger.warn(`Attempt to unbind stream to plugin, which doesn't attached. Stream GUID: ${guid}.`);
                return resolve();
            }
            if (!this._connections.has(guid)) {
                this._logger.warn(`Plugin process is already unbound from stream "${guid}" or it wasn't bound at all, because plugin doesn't listen "openStream" event`);
                return resolve();
            }
            // Passing sockets is not supported on Windows.
            this._process.send(`${CStdoutSocketAliases.unbind}${guid}`);
            this._setUnbindResolver(guid, resolve);
        });
    }

    public isAttached(): boolean {
        return this._process !== undefined;
    }

    private _bindRefWithId(socket: Net.Socket): Promise<void> {
        return new Promise((resolve, reject) => {
            socket.write(`[plugin:${this._opt.id}]`, (error: Error) => {
                if (error) {
                    return reject(new Error(this._logger.error(`Cannot send binding message into socket due error: ${error.message}`)));
                }
                resolve();
            });
        });
    }

    private _setBindResolver(guid: string, resolver: () => void) {
        this._resolvers.bind.set(guid, resolver);
        setTimeout(this._applyBindResolver.bind(this, guid), CSettings.resolverTimeout);
    }

    private _setUnbindResolver(guid: string, resolver: () => void) {
        this._resolvers.unbind.set(guid, resolver);
        setTimeout(this._applyUnbindResolver.bind(this, guid), CSettings.resolverTimeout);
    }

    private _applyBindResolver(guid: string) {
        const resolver = this._resolvers.bind.get(guid);
        if (resolver === undefined) {
            return;
        }
        resolver();
        this._resolvers.bind.delete(guid);
    }

    private _applyUnbindResolver(guid: string) {
        const resolver = this._resolvers.unbind.get(guid);
        if (resolver === undefined) {
            return;
        }
        resolver();
        this._resolvers.bind.delete(guid);
    }

    /**
     * Handler to listen stdout and stderr of plugin process
     * @returns void
     */
    private _onSTDData(chunk: Buffer): void {
        const str: string = chunk.toString();
        this._logger.debug(str);
        this.emit(ControllerPluginProcessSingle.Events.output);
    }

    /**
     * Handler to listen close event of process
     * @returns void
     */
    private _onClose(...args: any[]): void {
        this.kill();
        this.emit(ControllerPluginProcessSingle.Events.close, ...args);
    }

    /**
     * Handler to listen error event of process
     * @returns void
     */
    private _onError(...args: any[]): void {
        this.kill();
        this.emit(ControllerPluginProcessSingle.Events.error, ...args);
    }

    /**
     * Handler to listen disconnect event of process
     * @returns void
     */
    private _onDisconnect(...args: any[]): void {
        this.kill();
        this.emit(ControllerPluginProcessSingle.Events.disconnect, ...args);
    }

    private _onSessionStreamBound(message: IPCPluginMessages.SessionStreamBound) {
        if (message.error) {
            this._logger.warn(`Fail to bind stream due error: ${message.error}`);
        }
        this._applyBindResolver(message.streamId);
    }

    private _onSessionStreamUnbound(message: IPCPluginMessages.SessionStreamUnbound) {
        if (message.error) {
            this._logger.warn(`Fail to unbind stream due error: ${message.error}`);
        }
        this._applyUnbindResolver(message.streamId);
    }

}
