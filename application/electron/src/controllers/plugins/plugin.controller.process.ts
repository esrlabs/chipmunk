import * as path from 'path';
import * as FS from '../../tools/fs';
import * as Net from 'net';

import ControllerPluginPackage, { EProcessPluginType } from './plugin.package';
import ControllerPluginProcessMultiple from './plugin.process.multiple';
import ControllerPluginProcessSingle from './plugin.process.single';
import ControllerIPCPlugin from './plugin.process.ipc';

import { ControllerSession } from '../../controllers/stream.main/controller';

import Logger from '../../tools/env.logger';

export default class ControllerPluginProcess {
    private _packagejson: ControllerPluginPackage;
    private _name: string;
    private _token: string;
    private _id: number;
    private _logger: Logger;
    private _entrypoint: string | undefined;
    private _single: ControllerPluginProcessSingle | undefined;
    private _mulitple: Map<string, ControllerPluginProcessMultiple> = new Map();

    constructor(name: string, token: string, id: number, packagejson: ControllerPluginPackage) {
        this._name = name;
        this._token = token;
        this._id = id;
        this._packagejson = packagejson;
        this._logger = new Logger(`Plugin process [${this._name}]`);
    }

    public destroy(): Promise<void> {
        return new Promise((resolve, reject) => {
            if (this._single !== undefined) {
                this._single.kill();
                this._single = undefined;
            }
            this._mulitple.forEach((process: ControllerPluginProcessMultiple) => {
                process.kill();
            });
            this._mulitple.clear();
            resolve();
        });
    }

    public init(): Promise<void> {
        return new Promise((resolve, reject) => {
            const main: string = this._packagejson.getPackageJson().main;
            // Check main file of plugin
            const entrypoint: string = path.normalize(path.resolve(this._packagejson.getPath(), main));
            FS.exist(entrypoint).then((exist: boolean) => {
                if (!exist) {
                    return reject(new Error(this._logger.warn(`Target file "${entrypoint}" doesn't exist.`)));
                }
                this._entrypoint = entrypoint;
                resolve();
            });
        });
    }

    public isSingleProcess(): boolean {
        return this._packagejson.getPackageJson().chipmunk.type === EProcessPluginType.single;
    }

    public isMultipleProcess(): boolean {
        return this._packagejson.getPackageJson().chipmunk.type !== EProcessPluginType.single;
    }

    public getSessionIPC(session: string): ControllerIPCPlugin | undefined {
        let ipc: ControllerIPCPlugin | Error | undefined;
        const multiple = this._mulitple.get(session);
        if (multiple !== undefined) {
            ipc = multiple.getIPC();
        } else if (this._single !== undefined) {
            ipc = this._single.getIPC();
        }
        if (ipc === undefined) {
            return undefined;
        }
        if (ipc instanceof Error) {
            this._logger.warn(`Fail to get plugin's IPC due error: ${ipc.message}`);
            return undefined;
        }
        return ipc;
    }

    public runAsSingle(): Promise<void> {
        return new Promise((resolve, reject) => {
            if (this._packagejson.getPackageJson().chipmunk.type !== EProcessPluginType.single) {
                return reject(new Error(this._logger.warn(`Not single plugin cannot be started as single`)));
            }
            if (this._entrypoint === undefined) {
                return reject(new Error(this._logger.warn(`Fail to run plugin process while entrypoint isn't detected.`)));
            }
            if (this._single !== undefined) {
                return reject(new Error(this._logger.warn(`Plugin already has single process running`)));
            }
            this._single = new ControllerPluginProcessSingle({
                id: this._id,
                token: this._token,
                name: this._name,
                entrypoint: this._entrypoint,
            });
            this._single.attach().then(() => {
                this._logger.debug(`Plugin "${this._name}" is attached as single plugin.`);
                resolve();
            }).catch((attachError: Error) => {
                this._single = undefined;
                reject(new Error(this._logger.warn(`Fail to attach plugin "${this._name}" due error: ${attachError.message}`)));
            });
        });
    }

    public bindSinglePlugin(session: ControllerSession): Promise<void> {
        return new Promise((resolve, reject) => {
            const uuid = session.get().UUID();
            if (this._single === undefined) {
                return reject(new Error(this._logger.warn(`Plugin isn't single or wasn't running`)));
            }
            const process = this._single;
            // Binding controller
            session.get().socket().getConnection(`Pluign: ${this._name}`).then((connection) => {
                if (connection === undefined) {
                    // Debug mode
                    return reject(new Error(this._logger.debug(`[${this._name}]: no way to be attached to session "${uuid}" in DEBUG mode. Connection is "undefined".`)));
                }
                // Send data to plugin
                process.bindStream(uuid, connection).then(() => {
                    // Send notification
                    this._logger.debug(`[${this._name}]: attached to session "${uuid}"`);
                    resolve();
                }).catch((bindError: Error) => {
                    reject(new Error(this._logger.warn(`Fail to bind plugin ${this._name} due error: ${bindError.message}.`)));
                });
            }).catch((err: Error) => {
                return reject(new Error(this._logger.debug(`[${this._name}]: fail to attach to session "${uuid}" due error: ${err.message}`)));
            });
        });
    }

    public bindMultiplePlugin(session: ControllerSession): Promise<void> {
        return new Promise((resolve, reject) => {
            const uuid = session.get().UUID();
            if (this._packagejson.getPackageJson().chipmunk.type === EProcessPluginType.single) {
                return reject(new Error(this._logger.warn(`Not muplitple plugin cannot be started as single`)));
            }
            if (this._entrypoint === undefined) {
                return reject(new Error(this._logger.warn(`Fail to run plugin process while entrypoint isn't detected.`)));
            }
            if (this._mulitple.has(uuid)) {
                return reject(new Error(this._logger.warn(`Plugin already has process running for session ${uuid}`)));
            }
            const controller: ControllerPluginProcessMultiple = new ControllerPluginProcessMultiple({
                id: this._id,
                token: this._token,
                name: this._name,
                entrypoint: this._entrypoint,
            });
            controller.attach().then(() => {
                // Binding controller
                session.get().socket().getConnection(`Pluign: ${this._name}`).then((connection) => {
                    if (connection === undefined) {
                        // Debug mode
                        return reject(new Error(this._logger.debug(`[${this._name}]: no way to be attached to session "${uuid}" in DEBUG mode. Connection is "undefined".`)));
                    }
                    // Send data to plugin
                    controller.bindStream(uuid, connection).then(() => {
                        this._mulitple.set(uuid, controller);
                        this._logger.debug(`[${this._name}]: attached to session "${uuid}"`);
                        resolve();
                    }).catch((bindError: Error) => {
                        reject(new Error(this._logger.warn(`Fail to bind plugin due error: ${bindError.message}.`)));
                    });
                }).catch((err: Error) => {
                    return reject(new Error(this._logger.debug(`[${this._name}]: fail to attach to session "${uuid}" due error: ${err.message}`)));
                });
            }).catch((attachError: Error) => {
                reject(new Error(this._logger.warn(`Fail to attach plugin for session "${uuid}" due error: ${attachError.message}.`)));
            });
        });
    }

    public unbindSingle(session: string): Promise<void> {
        return new Promise((resolve, reject) => {
            if (this._single === undefined) {
                return reject(new Error(this._logger.warn(`Single process wasn't inited`)));
            }
            return this._single.unbindStream(session).then(() => {
                this._logger.debug(`Plugin is unbind from session ${session}`);
                resolve();
            }).catch((error: Error) => {
                reject(new Error(this._logger.warn(`Fail correctly unbind single plugin's process (session: ${session}) due error: ${error.message}`)));
            });
        });
    }

    public unbindMuliple(session: string): Promise<void> {
        return new Promise((resolve, reject) => {
            const multiple = this._mulitple.get(session);
            if (multiple === undefined) {
                return reject(new Error(this._logger.warn(`Fail to find process for session ${session}`)));
            }
            multiple.kill();
            this._mulitple.delete(session);
            this._logger.debug(`Plugin is unbind from session ${session}`);
            resolve();
        });
    }

}
