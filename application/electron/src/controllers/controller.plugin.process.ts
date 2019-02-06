import * as Path from 'path';
import * as FS from '../../platform/node/src/fs';

import Logger from '../../platform/node/src/env.logger';

import { IPlugin } from '../services/service.plugins';

import { Emitter } from '../../platform/cross/src/index';

import { ChildProcess, fork } from 'child_process';

/**
 * @class ControllerPluginProcess
 * @description Execute plugin node process and provide access to it
 */

export default class ControllerPluginProcess extends Emitter {

    public static Events = {
        close: Symbol(),
        disconnect: Symbol(),
        error: Symbol(),
        message: Symbol(),
        output: Symbol(),
    };

    private _logger: Logger;
    private _plugin: IPlugin;
    private _process: ChildProcess | undefined;

    constructor(plugin: IPlugin) {
        super();
        this._plugin = plugin;
        this._logger = new Logger(`plugin: ${this._plugin.name}`);
        this._onSTDData = this._onSTDData.bind(this);
        this._onClose = this._onClose.bind(this);
        this._onMessage = this._onMessage.bind(this);
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
            this._process = fork(main, [], { stdio: [ 'pipe', 'pipe', 'pipe', 'ipc' ] });
            this._process.stderr.on('data', this._onSTDData);
            this._process.stdout.on('data', this._onSTDData);
            this._process.on('close', this._onClose);
            this._process.on('message', this._onMessage);
            this._process.on('error', this._onError);
            this._process.on('disconnect', this._onDisconnect);
            resolve();
        });
    }

    /**
     * Sends message to process of plugin
     * @param {any} message message to plugin
     * @returns { Promise<void> }
     */
    public send(message: any): Promise<void> {
        return new Promise((resolve, reject) => {
            if (this._process === undefined) {
                return reject(new Error(`Plugin doesn't have attached process`));
            }
            if (!this._process.connected || this._process.killed) {
                return reject(new Error(`Process of plugin was killed / disconnected or wasn't connected at all.`));
            }
            this._process.send(message, (error: Error) => {
                if (error) {
                    return reject(error);
                }
                resolve();
            });
        });
    }

    /**
     * Attempt to kill plugin process
     * @returns void
     */
    public kill(): boolean {
        if (this._process === undefined) {
            return false;
        }
        this._process.kill();
        this._process = undefined;
        return true;
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
        this.emit(ControllerPluginProcess.Events.close, ...args);
    }

    /**
     * Handler to listen error event of process
     * @returns void
     */
    private _onError(...args: any[]): void {
        this.emit(ControllerPluginProcess.Events.error, ...args);
    }

    /**
     * Handler to listen disconnect event of process
     * @returns void
     */
    private _onDisconnect(...args: any[]): void {
        this.emit(ControllerPluginProcess.Events.disconnect, ...args);
    }

    /**
     * Handler to listen message from process
     * @returns void
     */
    private _onMessage(...args: any[]): void {
        this.emit(ControllerPluginProcess.Events.message, ...args);
    }
}
