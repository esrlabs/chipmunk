import * as Path from 'path';
import * as FS from '../tools/fs';
import * as Net from 'net';
import * as IPCPluginMessages from './plugins.ipc.messages/index';
import { ChildProcess, fork } from 'child_process';
import { Emitter } from '../tools/index';
import { IPlugin } from '../services/service.plugins';
import Logger from '../tools/env.logger';
import ControllerIPCPlugin from './controller.plugin.process.ipc';
import ServiceProduction from '../services/service.production';

const CDebugPluginPorts: { [key: string]: number } = {
    serial: 9240,
    processes: 9241,
};

/**
 * @class ControllerPluginProcess
 * @description Execute plugin node process and provide access to it
 */

export default class ControllerPluginProcess extends Emitter {

    public static Events = {
        close: Symbol(),
        disconnect: Symbol(),
        error: Symbol(),
        output: Symbol(),
    };

    private _logger: Logger;
    private _plugin: IPlugin;
    private _process: ChildProcess | undefined;
    private _ipc: ControllerIPCPlugin | undefined;
    private _boundStreamGuid: string | undefined;

    constructor(plugin: IPlugin) {
        super();
        this._plugin = plugin;
        this._logger = new Logger(`plugin: ${this._plugin.name}`);
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
            if (typeof this._plugin.packages.process.main !== 'string' || this._plugin.packages.process.main.trim() === '') {
                return reject(new Error(this._logger.error(`Field "main" of package.json isn't defined.`)));
            }
            const main: string = Path.resolve(this._plugin.path.process, this._plugin.packages.process.main);
            if (!FS.isExist(main)) {
                return reject(new Error(this._logger.error(`Cannot find file defined in "main" of package.json. File: ${main}.`)));
            }
            const args: string[] = [];
            if (!ServiceProduction.isProduction()) {
                args.push(`--inspect=127.0.0.1:${CDebugPluginPorts[this._plugin.name] === undefined ? (9229 + this._plugin.id - 1) : CDebugPluginPorts[this._plugin.name]}`);
            }
            this._process = fork(
                main,
                args,
                { stdio: [
                    'pipe', // stdin  - doesn't used by parent process
                    'pipe', // stdout - listened by parent process. Whole output from it goes to logs of parent process
                    'pipe', // stderr - listened by parent process. Whole output from it goes to logs of parent process
                    'ipc',  // ipc    - used by parent process as command sender / reciever
                    // 'pipe', // Stream is deliveried as UNIX socket. We don't need it at the moment. But probably in th future it will be used as channel for sending big data
                ] });
            // Getting data events
            this._process.stderr.on('data', this._onSTDData);
            this._process.stdout.on('data', this._onSTDData);
            // State process events
            this._process.on('exit', this._onClose);
            this._process.on('close', this._onClose);
            this._process.on('error', this._onError);
            this._process.on('disconnect', this._onDisconnect);
            // Create IPC controller
            this._ipc = new ControllerIPCPlugin(this._plugin.name, this._process, this._plugin.token);
            // Send token
            this._ipc.send(new IPCPluginMessages.PluginToken({
                token: this._plugin.token,
                id: this._plugin.id,
            })).catch((sendingError: Error) => {
                this._logger.error(`Fail delivery plugin token due error: ${sendingError.message}`);
            });
            resolve();
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
        this._ipc.destroy();
        !this._process.killed && this._process.kill(signal);
        this._process = undefined;
        return true;
    }

    public bindStream(guid: string, connection: { socket: Net.Socket, file: string }): Promise<void> {
        return new Promise((resolve, reject) => {
            if (this._process === undefined) {
                return reject(new Error(this._logger.warn(`Attempt to bind stream to plugin, which doesn't attached. Stream GUID: ${guid}.`)));
            }
            if (this._boundStreamGuid !== undefined) {
                return reject(new Error(this._logger.warn(`Plugin process is already bound with stream "${this._boundStreamGuid}"`)));
            }
            this._logger.env(`Sent information about stream GUID: ${guid}.`);
            // Bind socket
            this._bindRefWithId(connection.socket).then(() => {
                if (this._process === undefined) {
                    return reject(new Error(this._logger.warn(`Fail to bind stream to plugin, which doesn't attached. Stream GUID: ${guid}.`)));
                }
                // Send socket to plugin process
                if (process.platform === 'win32') {
                    // Passing sockets is not supported on Windows.
                    this._process.send(`[socket]:${guid};${connection.file}`);
                } else {
                    // On all other platforms we can pass socket
                    this._process.send(`[socket]:${guid};${connection.file}`, connection.socket);
                }
                resolve();
            }).catch(reject);
        });
    }

    private _bindRefWithId(socket: Net.Socket): Promise<void> {
        return new Promise((resolve, reject) => {
            socket.write(`[plugin:${this._plugin.id}]`, (error: Error) => {
                if (error) {
                    return reject(new Error(this._logger.error(`Cannot send binding message into socket due error: ${error.message}`)));
                }
                resolve();
            });
        });
    }

    /**
     * Handler to listen stdout and stderr of plugin process
     * @returns void
     */
    private _onSTDData(chunk: Buffer): void {
        const str: string = chunk.toString();
        this._logger.debug(str);
        this.emit(ControllerPluginProcess.Events.output);
    }

    /**
     * Handler to listen close event of process
     * @returns void
     */
    private _onClose(...args: any[]): void {
        this.kill();
        this.emit(ControllerPluginProcess.Events.close, ...args);
    }

    /**
     * Handler to listen error event of process
     * @returns void
     */
    private _onError(...args: any[]): void {
        this.kill();
        this.emit(ControllerPluginProcess.Events.error, ...args);
    }

    /**
     * Handler to listen disconnect event of process
     * @returns void
     */
    private _onDisconnect(...args: any[]): void {
        this.kill();
        this.emit(ControllerPluginProcess.Events.disconnect, ...args);
    }

}
