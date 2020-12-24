import * as Net from 'net';
import * as IPCPluginMessages from '../../../../common/ipc/plugins.ipc.messages/index';
import * as Tools from '../../tools/index';

import { ChildProcess, fork } from 'child_process';
import { Emitter, Subscription } from '../../tools/index';
import { CStdoutSocketAliases } from '../../consts/controller.plugin.process';

import Logger from '../../tools/env.logger';
import ControllerIPCPlugin from './plugin.process.ipc';
import ServiceProduction from '../../services/service.production';
import ServicePaths from '../../services/service.paths';

export const CFirstDebugPort = 9240;
export const CDebugPortSeqName = 'plugin_debug_ports';

const CSettings = {
    resolverTimeout: 3000,
};

interface IConnection {
    socket: Net.Socket;
    path: string;
}

interface IOpt {
    id: number;
    name: string;
    entrypoint: string;
    token: string;
}

const CPluginStartTimeout = 10000;

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
    private _stderr: string = '';
    private _rejector?: (error: Error) => void;
    private _resolver?: () => void;

    constructor(opt: IOpt) {
        super();
        this._opt = opt;
        this._logger = new Logger(`Plugin: ${this._opt.name}`);
        this._onSTDErr = this._onSTDErr.bind(this);
        this._onSTDOut = this._onSTDOut.bind(this);
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
            // Store rejector
            this._rejector = reject;
            this._resolver = resolve;
            // Prepare arguments
            const args: string[] = [
                `--chipmunk-settingspath=${ServicePaths.getPluginsCfgFolder()}`,
                `--chipmunk-plugin-alias=${this._opt.name.replace(/[^\d\w-_]/gi, '_')}`,
            ];
            if (!ServiceProduction.isProduction()) {
                args.push(`--inspect=127.0.0.1:${Tools.getSequence(CDebugPortSeqName, CFirstDebugPort)}`);
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
            this._process.stderr?.on('data', this._onSTDErr);
            this._process.stdout?.on('data', this._onSTDOut);
            // State process events
            this._process.on('exit', this._onClose);
            this._process.on('close', this._onClose);
            this._process.on('error', this._onError);
            this._process.on('disconnect', this._onDisconnect);
            // Create IPC controller
            const ipc = new ControllerIPCPlugin(this._opt.name, this._process, this._opt.token);
            // Subscribe to state event
            let subscription: Subscription | undefined;
            ipc.subscribe(IPCPluginMessages.PluginState, (state: IPCPluginMessages.PluginState) => {
                if (subscription !== undefined) {
                    subscription.destroy();
                }
                if (state.state !== IPCPluginMessages.EPluginState.ready) {
                    return this._reject(new Error(this._logger.error(`Fail to attach plugin, because plugin state is: ${state.state}`)));
                }
                // Send token
                ipc.send(new IPCPluginMessages.PluginToken({
                    token: this._opt.token,
                    id: this._opt.id,
                })).then(() => {
                    Promise.all([
                        ipc.subscribe(IPCPluginMessages.SessionStreamBound, this._onSessionStreamBound.bind(this)).then((_subscription: Subscription) => {
                            this._subscriptions.SessionStreamBound = _subscription;
                        }),
                        ipc.subscribe(IPCPluginMessages.SessionStreamUnbound, this._onSessionStreamUnbound.bind(this)).then((_subscription: Subscription) => {
                            this._subscriptions.SessionStreamUnbound = _subscription;
                        }),
                    ]).then(() => {
                        this._ipc = ipc;
                        this._resolve();
                    }).catch((error: Error) => {
                        this._reject(new Error(this._logger.warn(`Fail to subscribe to plugin's IPC events due error: ${error.message}`)));
                    });
                }).catch((sendingError: Error) => {
                    this._reject(new Error(this._logger.error(`Fail delivery plugin token due error: ${sendingError.message}`)));
                });
            }).then((_subscription: Subscription) => {
                subscription = _subscription;
                setTimeout(() => {
                    if (this._rejector !== undefined) {
                        this._reject(new Error(this._logger.error(`Fail to start plugin because timeout.`)));
                    }
                }, CPluginStartTimeout);
            }).catch((error: Error) => {
                this._reject(new Error(this._logger.warn(`Fail to subscribe to plugin's state event due error: ${error.message}`)));
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
    public kill(signal: NodeJS.Signals = 'SIGTERM'): boolean {
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].destroy();
        });
        if (this._ipc !== undefined) {
            this._ipc.destroy();
        }
        if (this._process !== undefined) {
            if (!this._process.killed) {
                this._process.kill(signal);
            }
            this._process = undefined;
            this._connections.clear();
        }
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
                    this._process.send(`${CStdoutSocketAliases.bind}${guid};${connection.path}`);
                } else {
                    // On all other platforms we can pass socket
                    this._process.send(`${CStdoutSocketAliases.bind}${guid};${connection.path}`, connection.socket);
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
            this._connections.delete(guid);
            // Passing sockets is not supported on Windows.
            this._process.send(`${CStdoutSocketAliases.unbind}${guid}`);
            this._setUnbindResolver(guid, resolve);
        });
    }

    public isAttached(): boolean {
        return this._process !== undefined;
    }

    private _reject(error: Error) {
        if (this._rejector === undefined || this._resolver === undefined) {
            return;
        }
        this.kill();
        this._rejector(error);
        this._rejector = undefined;
        this._resolver = undefined;
    }

    private _resolve() {
        if (this._rejector === undefined || this._resolver === undefined) {
            return;
        }
        this._resolver();
        this._rejector = undefined;
        this._resolver = undefined;
    }

    private _bindRefWithId(socket: Net.Socket): Promise<void> {
        return new Promise((resolve, reject) => {
            socket.write(`[plugin:${this._opt.id}]`, (error: Error | undefined) => {
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
    private _onSTDOut(chunk: Buffer): void {
        const str: string = chunk.toString();
        this._logger.save(this._opt.token, str);
        this.emit(ControllerPluginProcessSingle.Events.output);
    }

    /**
     * Handler to listen stdout and stderr of plugin process
     * @returns void
     */
    private _onSTDErr(chunk: Buffer): void {
        const str: string = chunk.toString();
        this._logger.save(this._opt.token, str);
        this._stderr += str;
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
        this._reject(new Error(this._stderr));
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
