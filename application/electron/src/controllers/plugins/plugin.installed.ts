// tslint:disable: max-classes-per-file

import * as path from 'path';
import * as FS from '../../tools/fs';
import * as tar from 'tar';
import * as semver from 'semver';
import * as Tools from '../../tools/index';
import * as ncp from 'ncp';

import Logger from '../../tools/env.logger';
import LogsService from '../../tools/env.logger.service';

import ControllerPluginPackage, { IPackageJson } from './plugin.package';
import ControllerPluginStore from './plugins.store';
import ControllerPluginRender from './plugin.controller.render';
import ControllerPluginProcess, { TConnectionFactory } from './plugin.controller.process';
import ControllerIPCPlugin from './plugin.process.ipc';
import ServicePaths from '../../services/service.paths';
import ServiceElectronService from '../../services/service.electron.state';
import ServicePackage from '../../services/service.package';
import ServiceElectron from '../../services/service.electron';

import { IPCMessages } from '../../services/service.electron';
import { CommonInterfaces } from '../../interfaces/interface.common';
import { getPluginReleaseInfoFromStr } from './plugins.validator';

export { IPackageJson, TConnectionFactory };

export type TPluginName = string;

export interface IInstalledPluginInfo extends CommonInterfaces.Plugins.IPlugin {
    package: {
        render: ControllerPluginPackage | undefined;
        process: ControllerPluginPackage | undefined;
    };
    controller: {
        render: ControllerPluginRender | undefined;
        process: ControllerPluginProcess | undefined;
    };
}

const CPluginInfoFile: string = 'info.json';

const CPluginsFolders = {
    process: 'process',
    render: 'render',
};

export class ErrorCompatibility extends Error {

    public phash: string;
    public expected: string;

    constructor(msg: string, phash: string, expected: string) {
        super(msg);
        this.expected = expected;
        this.phash = phash;
    }
}

export default class ControllerPluginInstalled {

    private _logger: Logger;
    private _path: string;
    private _name: string;
    private _info: CommonInterfaces.Plugins.IPlugin | undefined;
    private _packages: {
        render: ControllerPluginPackage | undefined;
        process: ControllerPluginPackage | undefined;
    } = {
        render: undefined,
        process: undefined,
    };
    private _controllers: {
        render: ControllerPluginRender | undefined;
        process: ControllerPluginProcess | undefined;
    } = {
        render: undefined,
        process: undefined,
    };
    private _store: ControllerPluginStore;
    private _token: string = Tools.guid();
    private _id: number = Tools.sequence();
    private _subscriptions: { [key: string]: Tools.Subscription } = {};

    constructor(_name: string, _path: string, store: ControllerPluginStore) {
        this._name = _name;
        this._path = _path;
        this._store = store;
        this._logger = new Logger(`ControllerPluginInstalled (${this._path})`);
        ServiceElectron.IPC.subscribe(IPCMessages.PluginsLogsRequest, this._ipc_PluginsLogsRequest.bind(this)).then((subscription: Tools.Subscription) => {
            this._subscriptions.PluginsLogsRequest = subscription;
        }).catch((error: Error) => {
            this._logger.warn(`Fail to subscribe on PluginsLogsRequest due error: ${error.message}`);
        });
    }

    public destroy(): Promise<void> {
        return new Promise((resolve) => {
            Object.keys(this._subscriptions).forEach((key: string) => {
                this._subscriptions[key].destroy();
            });
            if (this._controllers.process === undefined) {
                return resolve();
            }
            return this._controllers.process.destroy().then(() => {
                this._controllers.process = undefined;
            }).catch((error: Error) => {
                this._logger.warn(`Error during destroy plugin's process: ${error.message}`);
            }).finally(() => {
                resolve();
            });
        });
    }

    public shutdown(): Promise<void> {
        return new Promise((resolve) => {
            if (this._controllers.process === undefined) {
                return resolve();
            }
            return this._controllers.process.destroy().then(() => {
                this._controllers.process = undefined;
            }).catch((error: Error) => {
                this._logger.warn(`Error during shutdown plugin's process: ${error.message}`);
            }).finally(() => {
                resolve();
            });
        });
    }

    public read(): Promise<void> {
        return new Promise((resolve, reject) => {
            const filename: string = path.resolve(this._path, CPluginInfoFile);
            ServiceElectronService.logStateToRender(`Reading plugin data "${path.basename(this._path)}"`);
            FS.exist(filename).then((exist: boolean) => {
                if (!exist) {
                    return reject(new Error(this._logger.warn(`Not valid plugin. Info-file "${filename}" doesn't exist`)));
                }
                FS.readTextFile(filename).then((content: string) => {
                    const plugin: CommonInterfaces.Plugins.IPlugin | Error = getPluginReleaseInfoFromStr(content);
                    if (plugin instanceof Error) {
                        return reject(plugin);
                    }
                    if (!semver.valid(plugin.version)) {
                        return reject(new Error(`Plugin has not valid version: "${plugin.version}"`));
                    }
                    this._info = plugin;
                    if (plugin.phash !== ServicePackage.getHash(plugin.dependencies)) {
                        this._logger.warn(`Plugin could not be used, because hash dismatch.\n\t- plugin hash: ${plugin.phash}\n\t- expected plugin hash: ${ServicePackage.getHash(plugin.dependencies)}\n\t- chipmunk hash: ${ServicePackage.getHash()}`);
                        return reject(new ErrorCompatibility(`Version-hash dismatch`, plugin.phash, ServicePackage.getHash(plugin.dependencies)));
                    }
                    ServiceElectronService.logStateToRender(`Reading plugin package "${path.basename(this._path)}"`);
                    this._readPackages().then(() => {
                        if (this._packages.render === undefined && this._packages.process === undefined) {
                            this._info = undefined;
                            return reject(new Error(this._logger.warn(`Plugin doesn't have valid [render] and [process]. Plugin will not be used.`)));
                        }
                        ServiceElectronService.logStateToRender(`Creating controllers for "${path.basename(this._path)}"`);
                        this._addControllers().then(() => {
                            this._verify();
                            this._logPluginState();
                            resolve();
                        }).catch((controllersErr: Error) => {
                            reject(controllersErr);
                        });
                    }).catch((packageJsonErr: Error) => {
                        this._info = undefined;
                        reject(new Error(this._logger.warn(`Error during reading package.json of plugin: ${packageJsonErr.message}. Plugin will not be used.`)));
                    });
                }).catch((readingErr: Error) => {
                    this._logger.warn(`Fail read info-file due error: ${readingErr.message}`);
                    reject(readingErr);
                });
            }).catch((err: Error) => {
                this._logger.warn(`Fail check info-file due error: ${err.message}`);
                reject(err);
            });
        });
    }

    public getInfo(): CommonInterfaces.Plugins.IPlugin | undefined {
        if (this._info === undefined) {
            return undefined;
        }
        return Object.assign({}, this._info);
    }

    public getName(): string {
        if (this._info === undefined) {
            this._logger.error(`Attempt to get name of plugin, which isn't read or not valid.`);
        }
        return this._info?.name as string;
    }

    public getDisplayName(): string {
        if (this._info === undefined) {
            this._logger.error(`Attempt to get display_name of plugin, which isn't read or not valid.`);
        }
        return this._info?.display_name as string;
    }

    public getPath(): string {
        return this._path;
    }

    public getId(): number {
        return this._id;
    }

    public getToken(): string {
        return this._token;
    }

    public getSessionIPC(session: string): ControllerIPCPlugin | undefined {
        if (this._controllers.process === undefined) {
            return undefined;
        }
        return this._controllers.process.getSessionIPC(session);
    }

    public getRenderController(): ControllerPluginRender | undefined {
        if (this._controllers.render === undefined) {
            return undefined;
        }
        return this._controllers.render;
    }

    public remove(): Promise<void> {
        return new Promise((resolve, reject) => {
            ServiceElectronService.logStateToRender(`Removing plugin "${path.basename(this._path)}"`);
            FS.rmdir(this._path).then(() => {
                ServiceElectronService.logStateToRender(`Plugin "${path.basename(this._path)}" has been removed`);
                resolve();
            }).catch((error: Error) => {
                this._logger.warn(`Fail to remove file due error: ${error.message}`);
                reject(error);
            });
        });
    }

    public update(version?: string): Promise<void> {
        return new Promise((resolve, reject) => {
            if (this._info === undefined) {
                return reject(new Error(this._logger.warn(`Cannot update plugin, because it isn't initialized.`)));
            }
            if (typeof version !== 'string' || !semver.valid(version)) {
                version = this._store.getLatestVersion(this.getName())?.version;
                if (version === undefined) {
                    return reject(new Error(this._logger.warn(`Fail to find a suitable version for plugin "${this.getName()}"`)));
                }
            }
            const target: string = version;
            // Remove current version of plugin
            this.remove().then(() => {
                this._logger.debug(`Plugin is removed. New version will be downloaded`);
                ServiceElectronService.logStateToRender(`Updating plugin "${path.basename(this._path)}"...`);
                // Download updated version of plugin
                this._store.download(this._name, target).then((filename: string) => {
                    this._logger.debug(`New version of plugin is downloaded: ${filename}`);
                    ServiceElectronService.logStateToRender(`Unpacking package of plugin "${path.basename(this._path)}"`);
                    // Unpack plugin
                    this._unpack(filename).then(() => {
                        this._logger.debug(`Plugin is unpacked`);
                        ServiceElectronService.logStateToRender(`Plugin "${path.basename(this._path)}" has been unpacked`);
                        // Read plugin info once again
                        this.read().then(() => {
                            this._logger.debug(`Plugin is successfully updated`);
                            resolve();
                        }).catch((readErr: Error) => {
                            reject(new Error(this._logger.warn(`Fail to updated plugin due error: ${readErr.message}`)));
                        });
                    }).catch((unpackErr: Error) => {
                        reject(new Error(this._logger.warn(`Fail to unpack plugin due error: ${unpackErr.message}`)));
                    });
                }).catch((downloadErr: Error) => {
                    reject(new Error(`Fail to download new version of plugin due error: ${downloadErr.message}`));
                });
            }).catch((removeErr: Error) => {
                reject(new Error(this._logger.warn(`Fail to remove plugin due error: ${removeErr.message}`)));
            });
        });
    }

    public install(version?: string): Promise<void> {
        return new Promise((resolve, reject) => {
            const available: CommonInterfaces.Plugins.IPlugin | undefined = this._store.getInfo(this._name);
            if (available === undefined) {
                return reject(new Error(this._logger.warn(`Plugin will not be installed, because there are no such plugin in store`)));
            }
            if (typeof version !== 'string' || !semver.valid(version)) {
                version = this._store.getLatestVersion(this.getName())?.version;
                if (version === undefined) {
                    return reject(new Error(this._logger.warn(`Fail to find a suitable version for plugin "${this.getName()}"`)));
                }
            }
            // Download plugin
            this._store.download(this._name, version).then((filename: string) => {
                this._logger.debug(`Plugin is downloaded: ${filename}`);
                ServiceElectronService.logStateToRender(`Unpacking package of plugin "${path.basename(this._path)}"`);
                this.remove().then(() => {
                    // Unpack plugin
                    this._unpack(filename).then(() => {
                        ServiceElectronService.logStateToRender(`Plugin "${path.basename(this._path)}" has been unpacked`);
                        this._logger.debug(`Plugin is unpacked`);
                        // Read plugin info once again
                        this.read().then(() => {
                            this._logger.debug(`Plugin is successfully installed`);
                            resolve();
                        }).catch((readErr: Error) => {
                            reject(new Error(this._logger.warn(`Fail to install plugin due error: ${readErr.message}`)));
                        });
                    }).catch((unpackErr: Error) => {
                        reject(new Error(this._logger.warn(`Fail to unpack plugin due error: ${unpackErr.message}`)));
                    });
                }).catch((cleanErr: Error) => {
                    reject(new Error(this._logger.warn(`Fail to clean plugin folder due error: ${cleanErr.message}`)));
                });
            }).catch((downloadErr: Error) => {
                reject(new Error(`Fail to download plugin due error: ${downloadErr.message}`));
            });
        });
    }

    public import(tgz: string): Promise<void> {
        return new Promise((resolve, reject) => {
            FS.exist(tgz).then((exist: boolean) => {
                if (!exist) {
                    return reject(new Error(`File "${tgz}" doesn't exist.`));
                }
                const dest: string = path.resolve(ServicePaths.getTmp(), Tools.guid());
                FS.mkdir(dest).then(() => {
                    this._unpack(tgz, false, dest).then((cwd: string) => {
                        FS.readFolder(dest, FS.EReadingFolderTarget.folders).then((folders: string[]) => {
                            if (folders.length !== 1) {
                                return reject(new Error(this._logger.warn(`Expecting only one compressed folder, but found in "${tgz}":\n\t-${folders.join('\n\t-\t')}`)));
                            }
                            this._name = folders[0];
                            this._path = path.resolve(dest, folders[0]);
                            this._logger.debug(`Plugin "${folders[0]}" is unpacked into: ${dest}`);
                            resolve();
                        }).catch((fldReadErr: Error) => {
                            reject(new Error(this._logger.warn(`Fail to read dest folder "${dest}" due error: ${fldReadErr.message}`)));
                        });
                    }).catch((unpackErr: Error) => {
                        reject(new Error(this._logger.warn(`Fail to unpack plugin due error: ${unpackErr.message}`)));
                    });
                }).catch((mkdirErr: Error) => {
                    reject(new Error(this._logger.warn(`Fail to create temp-folder due error: ${mkdirErr.message}`)));
                });
            }).catch((existErr: Error) => {
                reject(new Error(this._logger.warn(`Fail to find file "${tgz}" due error: ${existErr.message}`)));
            });
        });
    }

    public delivery(): Promise<void> {
        return new Promise((resolve, reject) => {
            const dest: string = path.resolve(ServicePaths.getPlugins(), this._name);
            ncp(this._path, dest, (err: Error[] | null) => {
                if (err !== null) {
                    return reject(new Error(this._logger.warn(`Fail delivery plugin from "${this._path}" to "${dest}":\n\t- ${err.map(e => e.message).join('\n\t- ')}`)));
                }
                const tmp: string = path.resolve(this._path, '..');
                FS.rmdir(tmp).catch((rmErr: Error) => {
                    this._logger.warn(`Fail remove tmp plugin folder ${tmp} due error: ${rmErr.message}`);
                }).finally(() => {
                    this._path = path.resolve(ServicePaths.getPlugins(), this._name);
                    resolve();
                });
            });
        });
    }

    public getSuitableUpdates(): CommonInterfaces.Plugins.IHistory[] | Error {
        if (this._info === undefined) {
            return new Error(`Fail to check plugin, because it isn't loaded`);
        }
        const version: string = this._info.version;
        return this._store.getSuitableVersions(this.getName()).filter((record: CommonInterfaces.Plugins.IHistory) => {
            if (!semver.valid(record.version)) {
                this._logger.warn(`History of plugin "${this.getName()}" has wrong record: ${JSON.stringify(record)}. Version isn't valid`);
                return false;
            }
            /*
            compare(v1, v2): Return 0 if v1 == v2, or 1 if v1 is greater, or -1 if v2 is greater.
             */
            return semver.compare(record.version, version) === 1;
        });
    }

    public isSingleProcess(): boolean {
        if (this._info === undefined) {
            return false;
        }
        if (this._controllers.process === undefined) {
            return false;
        }
        return this._controllers.process.isSingleProcess();
    }

    public runAsSingle(): Promise<void> | Error {
        if (this._info === undefined) {
            return new Error(`Plugin isn't inited`);
        }
        if (this._controllers.process === undefined) {
            return new Error(`Plugin doesn't have process part`);
        }
        if (!this._controllers.process.isSingleProcess()) {
            return new Error(`Plugin isn't single process`);
        }
        return this._controllers.process.runAsSingle();
    }

    public bindWithSession(session: string, connectionFactory: TConnectionFactory): Promise<Error | undefined> {
        return new Promise((resolve, reject) => {
            if (this._info === undefined) {
                return resolve(new Error(`Plugin isn't inited`));
            }
            if (this._controllers.process === undefined) {
                return resolve(new Error(`Plugin doesn't have process part`));
            }
            if (this._controllers.process.isSingleProcess()) {
                this._controllers.process.bindSinglePlugin(session, connectionFactory).then(() => {
                    resolve(undefined);
                }).catch(reject);
            } else if (this._controllers.process.isMultipleProcess()) {
                this._controllers.process.bindMultiplePlugin(session, connectionFactory).then(() => {
                    resolve(undefined);
                }).catch(reject);
            }
        });
    }

    public unbindWithSession(session: string): Promise<void> {
        return new Promise((resolve, reject) => {
            if (this._info === undefined) {
                return reject(new Error(`Plugin isn't inited`));
            }
            if (this._controllers.process === undefined) {
                return reject(new Error(`Plugin doesn't have process part`));
            }
            if (this._controllers.process.isSingleProcess()) {
                this._controllers.process.unbindSingle(session).then(resolve).catch(reject);
            } else if (this._controllers.process.isMultipleProcess()) {
                this._controllers.process.unbindMuliple(session).then(resolve).catch(reject);
            }
        });
    }

    private _verify() {
        if (this._info === undefined) {
            return;
        }
        if (typeof this._info.display_name !== 'string' || this._info.display_name.trim() === '' || this._info.display_name === this._info.name) {
            let displayName: string | undefined;
            if (this._packages.process !== undefined && this._packages.process.getDisplayName() !== undefined) {
                displayName = this._packages.process.getDisplayName();
            }
            if (displayName === undefined && this._packages.render !== undefined && this._packages.render.getDisplayName() !== undefined) {
                displayName = this._packages.render.getDisplayName();
            }
            if (displayName !== undefined) {
                this._info.display_name = displayName;
            }
        }
    }

    private _logPluginState() {
        let msg = `Plugin state:\n`;
        if (this._info === undefined) {
            msg += `\tNOT READY`;
        } else {
            msg += `\tpackage render:\t\t${this._packages.render !== undefined ? 'OK' : '-'}\n\tpackage process:\t${this._packages.process !== undefined ? 'OK' : '-'}\n`;
            msg += `\tcontroller render:\t${this._controllers.render !== undefined ? 'OK' : '-'}\n\tcontroller process:\t${this._controllers.process !== undefined ? 'OK' : '-'}`;

        }
        this._logger.env(msg);
    }

    private _unpack(tgzfile: string, removetgz: boolean = true, cwd?: string): Promise<string> {
        return new Promise((resolve, reject) => {
            const _cwd = cwd === undefined ? ServicePaths.getPlugins() : cwd;
            tar.x({
                file: tgzfile,
                cwd: _cwd,
            }).then(() => {
                if (!removetgz) {
                    return resolve(_cwd);
                }
                FS.unlink(tgzfile).catch((removeErr: Error) => {
                    this._logger.warn(`Fail to remove ${tgzfile} due error: ${removeErr.message}`);
                }).finally(() => {
                    resolve(_cwd);
                });
            }).catch(reject);
        });
    }

    private _readPackages(): Promise<void> {
        return new Promise((resolve, reject) => {
            if (this._info === undefined) {
                return reject(new Error(`Basic info hadn't been read`));
            }
            const render = new ControllerPluginPackage(path.resolve(this._path, CPluginsFolders.render), this._name);
            const process = new ControllerPluginPackage(path.resolve(this._path, CPluginsFolders.process), this._name);
            Promise.all([
                render.read().then(() => {
                    this._packages.render = render;
                }).catch(() => {
                    return Promise.resolve();
                }),
                process.read().then(() => {
                    this._packages.process = process;
                }).catch(() => {
                    return Promise.resolve();
                }),
            ]).catch((error: Error) => {
                this._logger.debug(`Error reading package.json: ${error.message}`);
            }).finally(() => {
                resolve();
            });
        });
    }

    private _addControllers(): Promise<void> {
        return new Promise((resolve, reject) => {
            if (this._info === undefined) {
                return reject(new Error(`Basic info hadn't been read`));
            }
            if (this._packages.process === undefined && this._packages.render === undefined) {
                return reject(new Error(`Packages hadn't been read`));
            }
            const tasks = [];
            if (this._packages.render !== undefined) {
                const render = new ControllerPluginRender(this._name, this._packages.render);
                tasks.push(render.init().then(() => {
                    this._controllers.render = render;
                }).catch((error: Error) => {
                    this._logger.warn(`Fail to init render controller due error: ${error.message}`);
                    if (this._info === undefined) {
                        return;
                    }
                    this._controllers.render = undefined;
                }));
            }
            if (this._packages.process !== undefined) {
                const process = new ControllerPluginProcess(this._name, this._token, this._id, this._packages.process);
                tasks.push(process.init().then(() => {
                    this._controllers.process = process;
                }).catch((error: Error) => {
                    this._logger.warn(`Fail to init process controller due error: ${error.message}`);
                    if (this._info === undefined) {
                        return;
                    }
                    this._controllers.process = undefined;
                }));
            }
            Promise.all(tasks).then(() => {
                resolve();
            }).catch((initErr: Error) => {
                reject(initErr);
            });
        });
    }

    private _ipc_PluginsLogsRequest(request: IPCMessages.TMessage, response: (instance: IPCMessages.TMessage) => any) {
        const msg: IPCMessages.PluginsLogsRequest = request as IPCMessages.PluginsLogsRequest;
        if (msg.name !== this._name) {
            return;
        }
        response(new IPCMessages.PluginsLogsResponse({
            logs: LogsService.getStored(this._token),
        })).catch((error: Error) => {
            this._logger.warn(`Fail delivery log for plugin due error: ${error.message}`);
        });
    }

}
