import * as path from 'path';
import * as FS from '../../tools/fs';
import * as semver from 'semver';

import Logger from '../../tools/env.logger';
import ServicePaths from '../../services/service.paths';
import ServiceRenderState from '../../services/service.render.state';
import ServiceElectron from '../../services/service.electron';
import ServiceElectronService from '../../services/service.electron.state';
import ServiceEnv from '../../services/service.env';
import ServiceSettings from '../../services/service.settings';

import InstalledPlugin from './plugin.installed';
import ControllerPluginStore from './plugins.store';
import ControllerPluginsStorage from './plugins.storage';
import ControllerPluginsIncompatiblesStorage from './plugins.incompatibles';

import { IPCMessages, Subscription } from '../../services/service.electron';
import { CommonInterfaces } from '../../interfaces/interface.common';
import { ErrorCompatibility } from './plugin.installed';
import { PromisesQueue } from '../../tools/promise.queue';
import { dialog, OpenDialogReturnValue } from 'electron';
import { CSettingsAliases, CSettingsEtries, registerPluginsManagerSettings } from './settings/settings.index';

interface IQueueTask {
    name: string;
    version: string;
}

/**
 * @class ControllerPluginsManager
 * @description Delivery default plugins into chipmunk folder
 */

export default class ControllerPluginsManager {

    private _logger: Logger = new Logger('ControllerPluginsManager');
    private _queue: {
        install: Map<string, IQueueTask>,
        uninstall: Map<string, string>,
        upgrade: Map<string, IQueueTask>,
        update: Map<string, IQueueTask>,
        compatibility: Map<string, IQueueTask>,
    } = {
        install: new Map(),
        uninstall: new Map(),
        upgrade: new Map(),
        update: new Map(),
        compatibility: new Map(),
    };
    private _store: ControllerPluginStore;
    private _storage: ControllerPluginsStorage;
    private _incompatibles: ControllerPluginsIncompatiblesStorage;
    private _downloads: PromisesQueue = new PromisesQueue('Downloads plugins queue');
    private _subscriptions: { [key: string ]: Subscription } = { };
    private _settings: {
        [CSettingsAliases.PluginsUpdates]: boolean,
        [CSettingsAliases.PluginsUpgrades]: boolean,
        [CSettingsAliases.RemoveNotValid]: boolean,
        [CSettingsAliases.DefaultsPlugins]: boolean,
    } = {
        [CSettingsAliases.PluginsUpdates]: true,
        [CSettingsAliases.PluginsUpgrades]: true,
        [CSettingsAliases.RemoveNotValid]: true,
        [CSettingsAliases.DefaultsPlugins]: true,
    };

    constructor(store: ControllerPluginStore, storage: ControllerPluginsStorage) {
        this._store = store;
        this._storage = storage;
        this._incompatibles = new ControllerPluginsIncompatiblesStorage();
    }

    public init(): Promise<void> {
        return new Promise((resolve, reject) => {
            Promise.all([
                ServiceElectron.IPC.subscribe(IPCMessages.PluginsInstalledRequest, this._ipc_PluginsInstalledRequest.bind(this)).then((subscription: Subscription) => {
                    this._subscriptions.PluginsInstalledRequest = subscription;
                }),
                ServiceElectron.IPC.subscribe(IPCMessages.PluginsIncompatiblesRequest, this._ipc_PluginsIncompatiblesRequest.bind(this)).then((subscription: Subscription) => {
                    this._subscriptions.PluginsIncompatiblesRequest = subscription;
                }),
                ServiceElectron.IPC.subscribe(IPCMessages.PluginsStoreAvailableRequest, this._ipc_PluginsStoreAvailableRequest.bind(this)).then((subscription: Subscription) => {
                    this._subscriptions.PluginsStoreAvailableRequest = subscription;
                }),
                ServiceElectron.IPC.subscribe(IPCMessages.PluginsInstallRequest, this._ipc_PluginsInstallRequest.bind(this)).then((subscription: Subscription) => {
                    this._subscriptions.PluginsInstallRequest = subscription;
                }),
                ServiceElectron.IPC.subscribe(IPCMessages.PluginsUpdateRequest, this._ipc_PluginsUpdateRequest.bind(this)).then((subscription: Subscription) => {
                    this._subscriptions.PluginsUpdateRequest = subscription;
                }),
                ServiceElectron.IPC.subscribe(IPCMessages.PluginsUpgradeRequest, this._ipc_PluginsUpgradeRequest.bind(this)).then((subscription: Subscription) => {
                    this._subscriptions.PluginsUpgradeRequest = subscription;
                }),
                ServiceElectron.IPC.subscribe(IPCMessages.PluginsUninstallRequest, this._ipc_PluginsUninstallRequest.bind(this)).then((subscription: Subscription) => {
                    this._subscriptions.PluginsUninstallRequest = subscription;
                }),
                ServiceElectron.IPC.subscribe(IPCMessages.PluginAddRequest, this._ipc_PluginAddRequest.bind(this)).then((subscription: Subscription) => {
                    this._subscriptions.PluginAddRequest = subscription;
                }),
                ServiceElectron.IPC.subscribe(IPCMessages.PluginDefaultUninstall, this._ipc_PluginDefaultUninstall.bind(this)).then((subscription: Subscription) => {
                    this._subscriptions.PluginDefaultUninstall = subscription;
                }),
                ServiceElectron.IPC.subscribe(IPCMessages.PluginDefaultReinstall, this._ipc_PluginDefaultReinstall.bind(this)).then((subscription: Subscription) => {
                    this._subscriptions.PluginDefaultReinstall = subscription;
                }),
            ]).then(() => {
                this._logger.debug(`All subscriptions are done`);
            }).catch((error: Error) => {
                this._logger.debug(`Fail to subscribe due error: ${error.message}`);
            }).finally(() => {
                registerPluginsManagerSettings().catch((settingErr: Error) => {
                    this._logger.debug(`Fail to register settings due error: ${settingErr.message}`);
                }).finally(() => {
                    this._loadSettings();
                    resolve();
                });
            });
        });
    }

    public destroy(): Promise<void> {
        return new Promise((resolve) => {
            Object.keys(this._subscriptions).forEach((key: string) => {
                (this._subscriptions as any)[key].destroy();
            });
            resolve();
        });
    }

    public load(): Promise<void> {
        return new Promise((resolve, reject) => {
            ServiceElectronService.logStateToRender(`Reading installed plugins...`);
            const pluginStorageFolder: string = ServicePaths.getPlugins();
            // Get all sub folders from plugins folder. Expecting: there are plugins folders
            FS.readFolders(pluginStorageFolder).then((folders: string[]) => {
                if (folders.length === 0) {
                    // No any plugins
                    this._logger.debug(`No any plugins were found. Target folder: ${pluginStorageFolder}`);
                    return resolve();
                }
                const toBeRemoved: InstalledPlugin[] = [];
                // Check each plugin folder and read package.json of render and process apps
                Promise.all(folders.map((folder: string) => {
                    const plugin: InstalledPlugin = new InstalledPlugin(folder, path.resolve(pluginStorageFolder, folder), this._store);
                    return plugin.read().then(() => {
                        this._storage.include(plugin);
                    }).catch((pluginErr: Error | ErrorCompatibility) => {
                        if (pluginErr instanceof ErrorCompatibility) {
                            this._logger.warn(`Plugin "${plugin.getName()}" could not be used because compability: ${pluginErr.message}`);
                            const version: string | undefined = this._store.getLatestVersion(plugin.getName())?.version;
                            this._queue.compatibility.set(plugin.getName(), {
                                name: plugin.getName(),
                                version: version === undefined ? 'latest' : version,
                            });
                            this._incompatibles.add(plugin);
                        } else {
                            this._logger.warn(`Fail to read plugin data in "${folder}". Plugin will be ignored. Error: ${pluginErr.message}`);
                            toBeRemoved.push(plugin);
                        }
                    });
                })).catch((readErr: Error) => {
                    this._logger.warn(`Error during reading plugins: ${readErr.message}`);
                }).finally(() => {
                    ServiceElectronService.logStateToRender(`Removing invalid plugins...`);
                    if (!this._settings.RemoveNotValid) {
                        if (toBeRemoved.length > 0) {
                            this._logger.debug(`Found ${toBeRemoved.length} not valid plugins to be removed. But because this._settings.RemoveNotValid=false, plugins will not be removed. Not valid plugins:\n${toBeRemoved.map((plugin: InstalledPlugin) => {
                                return `\t - ${plugin.getPath()}`;
                            }).join('\n')}`);
                        }
                        return resolve();
                    } else {
                        Promise.all(toBeRemoved.map((plugin: InstalledPlugin) => {
                            return plugin.remove().then(() => {
                                ServiceElectronService.logStateToRender(`Plugin "${plugin.getPath()}" has been removed.`);
                                this._logger.debug(`Plugin "${plugin.getPath()}" is removed.`);
                            }).catch((removeErr: Error) => {
                                this._logger.warn(`Fail remove plugin "${plugin.getPath()}" due error: ${removeErr.message}`);
                                return Promise.resolve();
                            });
                        })).catch((removeErr: Error) => {
                            this._logger.warn(`Error during removing plugins: ${removeErr.message}`);
                        }).finally(() => {
                            resolve();
                        });
                    }
                });
            }).catch((error: Error) => {
                this._logger.error(`Fail to read plugins folder (${pluginStorageFolder}) due error: ${error.message}.`);
                resolve();
            });
        });
    }

    public add(name: string, version: string): Promise<void> {
        return new Promise((resolve, reject) => {
            if (this._downloads.has(name)) {
                return reject(new Error(this._logger.warn(`Plugin "${name}" is already in queue`)));
            }
            this._downloads.add(this._store.delivery(name, version), name).then(() => {
                this._queue.install.set(name, { name: name, version: version });
                resolve();
            }).catch((deliveryErr: Error) => {
                reject(deliveryErr);
            });
        });
    }

    public update(name: string, version: string): Promise<void> {
        return new Promise((resolve, reject) => {
            if (this._downloads.has(name)) {
                return reject(new Error(this._logger.warn(`Plugin "${name}" is already in queue`)));
            }
            this._downloads.add(this._store.delivery(name, version), name).then(() => {
                this._queue.update.set(name, { name: name, version: version });
                resolve();
            }).catch((deliveryErr: Error) => {
                reject(deliveryErr);
            });
        });
    }

    public upgrade(name: string, version: string): Promise<void> {
        return new Promise((resolve, reject) => {
            if (this._downloads.has(name)) {
                return reject(new Error(this._logger.warn(`Plugin "${name}" is already in queue`)));
            }
            this._downloads.add(this._store.delivery(name, version), name).then(() => {
                this._queue.upgrade.set(name, { name: name, version: version });
                resolve();
            }).catch((deliveryErr: Error) => {
                reject(deliveryErr);
            });
        });
    }

    public remove(name: string): Promise<void> {
        return new Promise((resolve, reject) => {
            this._queue.uninstall.set(name, name);
            resolve();
        });
    }

    public install(plugins: IQueueTask[]): Promise<void> {
        return new Promise((resolve, reject) => {
            Promise.all(plugins.map((task: IQueueTask) => {
                const plugin: InstalledPlugin = new InstalledPlugin(task.name, path.resolve(ServicePaths.getPlugins(), task.name), this._store);
                return plugin.install(task.version).then(() => {
                    this._logger.env(`Plugin "${task.name}" is installed. Will include plugin into storage.`);
                    this._storage.include(plugin);
                }).catch((installErr: Error) => {
                    this._logger.warn(`Fail to isntall plugin "${task.name}" due error: ${installErr.message}`);
                });
            })).catch((error: Error) => {
                reject(error);
            }).finally(() => {
                resolve();
            });
        });
    }

    public uninstall(plugins: InstalledPlugin[]): Promise<void> {
        return new Promise((resolve, reject) => {
            Promise.all(plugins.map((plugin: InstalledPlugin) => {
                return plugin.remove().catch((removeErr: Error) => {
                    this._logger.warn(`Fail to remove plugin "${plugin.getName()}" due error: ${removeErr.message}. In any way will try to exclude plugin.`);
                }).finally(() => {
                    return this._storage.exclude(plugin.getName()).catch((exclErr: Error) => {
                        this._logger.warn(`Fail exclude plugin "${plugin.getName()}" due error: ${exclErr.message}`);
                    });
                });
            })).then(() => {
                resolve();
            }).catch((error: Error) => {
                reject(error);
            });
        });
    }

    public defaults(): Promise<void> {
        return new Promise((resolve) => {
            if (!this._settings.DefaultsPlugins) {
                this._logger.debug(`Checking defaults plugins is skipped because envvar _settings.DefaultsPlugins is false`);
                return resolve();
            }
            const installed: string[] = this.getInstalled().map((plugin: CommonInterfaces.Plugins.IPlugin) => {
                return plugin.name;
            }).filter(n => n !== undefined);
            const required: IQueueTask[] = this._store.getDefaults(installed).map((name: string) => {
                const version: string | undefined = this._store.getLatestVersion(name)?.version;
                if (version === undefined) {
                    return { name: '', version: '' };
                } else {
                    return { name: name, version: version };
                }
            }).filter(r => r.name !== '');
            if (required.length === 0) {
                return resolve();
            }
            this._logger.debug(`Installing default plugins`);
            this._filterDefault(required).then((tasks: IQueueTask[]) => {
                this.install(tasks).catch((error: Error) => {
                    this._logger.warn(`Error during installation of plugins: ${error.message}`);
                }).finally(() => {
                    resolve();
                });
            }).catch((error: Error) => {
                this._logger.warn(`Fail to filter uninstalled default plugins due error: ${error.message}`);
            });
        });
    }

    public getInstalled(): CommonInterfaces.Plugins.IPlugin[] {
        const installed: InstalledPlugin[] = this._storage.getInstalled();
        return installed.map((plugin: InstalledPlugin) => {
            return plugin.getInfo();
        }).filter((info: CommonInterfaces.Plugins.IPlugin | undefined) => {
            return info !== undefined;
        }) as CommonInterfaces.Plugins.IPlugin[];
    }

    public getIncompatibles(): CommonInterfaces.Plugins.IPlugin[] {
        const incompatibles: InstalledPlugin[] = this._incompatibles.get();
        return incompatibles.map((plugin: InstalledPlugin) => {
            return plugin.getInfo();
        }).filter((info: CommonInterfaces.Plugins.IPlugin | undefined) => {
            return info !== undefined;
        }) as CommonInterfaces.Plugins.IPlugin[];
    }

    public revision() {
        this._store.remote().then(() => {
            this._logger.env(`Plugin's state is updated from remote store`);
        }).catch((error: Error) => {
            this._logger.env(`Fail to update plugin's state from remote store due error: ${error.message}`);
        }).finally(() => {
            ServiceRenderState.doOnReady('ControllerPluginsManager: PluginsDataReady', () => {
                ServiceElectron.IPC.send(new IPCMessages.PluginsDataReady()).then(() => {
                    this._logger.env(`Notification about plugins data state was sent to render`);
                }).catch((notifyErr: Error) => {
                    this._logger.warn(`Fail to notify render about plugins data state due error: ${notifyErr.message}`);
                }).finally(() => {
                    // Check plugins to be upgraded
                    this._queue.compatibility.forEach((task: IQueueTask) => {
                        ServiceElectron.IPC.send(new IPCMessages.PluginsNotificationUpgrade({
                            name: task.name,
                            versions: this._store.getSuitableVersions(task.name),
                        }));
                    });
                    // Check plugins to be update
                    this._storage.getInstalled().forEach((plugin: InstalledPlugin) => {
                        const updates: CommonInterfaces.Plugins.IHistory[] | Error = plugin.getSuitableUpdates();
                        if (updates instanceof Error) {
                            this._logger.warn(`Fail to get suitable update for plugin "${plugin.getName()}" due error: ${updates.message}`);
                            return;
                        }
                        if (updates.length === 0) {
                            return;
                        }
                        this._logger.debug(`Plugin "${plugin.getName()}" has available updates:\n${updates.map(u => `\t- ${u.version}`).join('\n')}`);
                        ServiceElectron.IPC.send(new IPCMessages.PluginsNotificationUpdate({
                            name: plugin.getName(),
                            versions: updates,
                        }));
                    });
                });
            });
        });
    }

    public accomplish(): Promise<void> {
        return new Promise((resolve, reject) => {
            // Shutdown all plugins
            this._storage.shutdown().then(() => {
                this._logger.debug(`All plugins are down`);
            }).catch((shutdownErr: Error) => {
                this._logger.warn(`Fail to shutdown all plugins before close due error: ${shutdownErr.message}`);
            }).finally(() => {
                this._downloads.do(() => {
                    // Upgrade tasks
                    const upgrade: Promise<any> = Promise.all(!this._settings.PluginsUpgrades ? [] : Array.from(this._queue.upgrade.values()).map((task: IQueueTask) => {
                        return this.install([task]).catch((upgErr: Error) => {
                            this._logger.warn(`Fail to upgrade plugin "${task.name}" due error: ${upgErr.message}`);
                        });
                    })).then(() => {
                        this._logger.warn(`Upgrade - done`);
                    }).catch((error: Error) => {
                        this._logger.warn(`Fail to do upgrade of plugins due error: ${error.message}`);
                    });
                    // Update tasks
                    const update: Promise<any> = Promise.all(!this._settings.PluginsUpdates ? [] : Array.from(this._queue.update.values()).map((task: IQueueTask) => {
                        const plugin: InstalledPlugin | undefined = this._storage.getPluginByName(task.name);
                        if (plugin === undefined) {
                            this._logger.warn(`Fail to find installed plugin "${task.name}" to update it`);
                            return Promise.resolve();
                        }
                        return plugin.update(task.version).catch((updErr: Error) => {
                            this._logger.warn(`Fail to update plugin "${task.name}" to version ${task.version} due error: ${updErr.message}`);
                        });
                    })).then(() => {
                        this._logger.warn(`Update - done`);
                    }).catch((error: Error) => {
                        this._logger.warn(`Fail to do update of plugins due error: ${error.message}`);
                    });
                    // Installation
                    const install: Promise<any> = Promise.all(Array.from(this._queue.install.values()).map((task: IQueueTask) => {
                        return this.install([task]).catch((instErr: Error) => {
                            this._logger.warn(`Fail to install plugin "${name}" due error: ${instErr.message}`);
                        });
                    })).then(() => {
                        this._logger.warn(`Install - done`);
                    }).catch((error: Error) => {
                        this._logger.warn(`Fail to do install of plugins due error: ${error.message}`);
                    });
                    // Deinstall
                    const uninstall: Promise<any> = Promise.all(Array.from(this._queue.uninstall.values()).map((name: string) => {
                        const plugin: InstalledPlugin | undefined = this._storage.getPluginByName(name);
                        if (plugin === undefined) {
                            this._logger.warn(`Fail to find a plugin "${name}" to uninstall it`);
                            return Promise.resolve();
                        }
                        return plugin.remove().then(() => {
                            this._logger.debug(`Plugin "${name}" is removed.`);
                        }).catch((rmErr: Error) => {
                            this._logger.warn(`Fail to remove plugin "${name}" due error: ${rmErr.message}`);
                        });
                    })).then(() => {
                        this._logger.warn(`Deinstall - done`);
                    }).catch((error: Error) => {
                        this._logger.warn(`Fail to do uninstall of plugins due error: ${error.message}`);
                    });
                    Promise.all([
                        upgrade,
                        update,
                        uninstall,
                        install,
                    ]).then(() => {
                        resolve();
                    }).catch((error: Error) => {
                        reject(new Error(this._logger.warn(`Fail to update plugins due error: ${error.message}`)));
                    });
                });
            });
        });
    }

    private _ipc_PluginDefaultUninstall(request: IPCMessages.TMessage, response: (instance: IPCMessages.TMessage) => any) {
        const arr: string[] = [];
        const fullfilename = ServicePaths.getUninstalledDefaultPlugins();
        const req: IPCMessages.PluginDefaultUninstall = request as IPCMessages.PluginDefaultUninstall;
        FS.exist(ServicePaths.getUninstalledDefaultPlugins()).then((exist: boolean) => {
            if (!exist) {
                FS.writeTextFile(fullfilename, JSON.stringify([req.name]));
            } else {
                FS.readTextFile(fullfilename).then((json: string) => {
                    JSON.parse(json).forEach((entry: string) => {
                        if (entry !== req.name) {
                            arr.push(entry);
                        }
                    });
                    arr.push(req.name);
                    FS.writeTextFile(fullfilename, JSON.stringify(arr));
                });
            }
        }).catch((existErr: Error) => {
            this._logger.warn(`Fail to save ${req.name} as uninstalled due error: ${existErr.message}`);
        });
    }

    private _ipc_PluginDefaultReinstall(request: IPCMessages.TMessage, response: (instance: IPCMessages.TMessage) => any) {
        const arr: string[] = [];
        const fullfilename = ServicePaths.getUninstalledDefaultPlugins();
        const req: IPCMessages.PluginDefaultUninstall = request as IPCMessages.PluginDefaultUninstall;
        FS.exist(ServicePaths.getUninstalledDefaultPlugins()).then((exist: boolean) => {
            if (exist) {
                FS.readTextFile(fullfilename).then((json: string) => {
                    JSON.parse(json).forEach((entry: string) => {
                        if (entry !== req.name) {
                            arr.push(entry);
                        }
                    });
                    FS.writeTextFile(fullfilename, JSON.stringify(arr));
                });
            }
        }).catch((existErr: Error) => {
            this._logger.warn(`Fail to save ${req.name} as reinstalled due error: ${existErr.message}`);
        });
    }

    private _ipc_PluginsInstalledRequest(message: IPCMessages.PluginsInstalledRequest, response: (instance: any) => any) {
        response(new IPCMessages.PluginsInstalledResponse({
            plugins: this.getInstalled().map((plugin: CommonInterfaces.Plugins.IPlugin) => {
                plugin.suitable = this._store.getSuitableVersions(plugin.name).map(r => r.version);
                return plugin;
            }),
        })).catch((error: Error) => {
            this._logger.warn(`Fail to send response on PluginsInstalledRequest due error: ${error.message}`);
        });
    }

    private _ipc_PluginsIncompatiblesRequest(message: IPCMessages.PluginsIncompatiblesRequest, response: (instance: any) => any) {
        response(new IPCMessages.PluginsIncompatiblesResponse({
            plugins: this.getIncompatibles().map((plugin: CommonInterfaces.Plugins.IPlugin) => {
                plugin.suitable = [];
                return plugin;
            }),
        })).catch((error: Error) => {
            this._logger.warn(`Fail to send response on PluginsIncompatiblesRequest due error: ${error.message}`);
        });
    }

    private _ipc_PluginsStoreAvailableRequest(message: IPCMessages.PluginsStoreAvailableRequest, response: (instance: any) => any) {
        response(new IPCMessages.PluginsStoreAvailableResponse({
            plugins: this._store.getAvailable().map((plugin: CommonInterfaces.Plugins.IPlugin) => {
                plugin.suitable = this._store.getSuitableVersions(plugin.name).map(r => r.version);
                return plugin;
            }),
        })).catch((error: Error) => {
            this._logger.warn(`Fail to send response on PluginsStoreAvailableResponse due error: ${error.message}`);
        });
    }

    private _ipc_PluginsInstallRequest(message: IPCMessages.TMessage, response: (instance: any) => any) {
        const msg: IPCMessages.PluginsInstallRequest = message as IPCMessages.PluginsInstallRequest;
        let version: string | undefined = msg.version;
        if (typeof version !== 'string' || version === 'latest' || !semver.valid(version)) {
            version = this._store.getLatestVersion(msg.name)?.version;
            if (version === undefined) {
                return response(new IPCMessages.PluginsInstallResponse({
                    error: this._logger.warn(`Fail to find suitable version`),
                })).catch((error: Error) => {
                    this._logger.warn(`Fail to send response on PluginsInstallResponse due error: ${error.message}`);
                });
            }
        }
        this.add(msg.name, version).then(() => {
            response(new IPCMessages.PluginsInstallResponse({})).catch((error: Error) => {
                this._logger.warn(`Fail to send response on PluginsInstallResponse due error: ${error.message}`);
            });
        }).catch((addErr: Error) => {
            this._logger.warn(`Fail to delivery requested plugin "${msg.name}" due error: ${addErr.message}`);
            response(new IPCMessages.PluginsInstallResponse({
                error: addErr.message,
            })).catch((error: Error) => {
                this._logger.warn(`Fail to send response on PluginsInstallResponse due error: ${error.message}`);
            });
        });
    }

    private _ipc_PluginsUpdateRequest(message: IPCMessages.TMessage, response: (instance: any) => any) {
        const msg: IPCMessages.PluginsInstallRequest = message as IPCMessages.PluginsUpdateRequest;
        let version: string | undefined = msg.version;
        if (typeof version !== 'string' || version === 'latest' || !semver.valid(version)) {
            version = this._store.getLatestVersion(msg.name)?.version;
            if (version === undefined) {
                return response(new IPCMessages.PluginsUpdateResponse({
                    error: this._logger.warn(`Fail to find suitable version`),
                })).catch((error: Error) => {
                    this._logger.warn(`Fail to send response on PluginsUpdateResponse due error: ${error.message}`);
                });
            }
        }
        this.update(msg.name, version).then(() => {
            response(new IPCMessages.PluginsUpdateResponse({})).catch((error: Error) => {
                this._logger.warn(`Fail to send response on PluginsUpdateResponse due error: ${error.message}`);
            });
        }).catch((addErr: Error) => {
            this._logger.warn(`Fail to delivery requested plugin "${msg.name}" due error: ${addErr.message}`);
            response(new IPCMessages.PluginsUpdateResponse({
                error: addErr.message,
            })).catch((error: Error) => {
                this._logger.warn(`Fail to send response on PluginsUpdateResponse due error: ${error.message}`);
            });
        });
    }

    private _ipc_PluginsUpgradeRequest(message: IPCMessages.TMessage, response: (instance: any) => any) {
        const msg: IPCMessages.PluginsInstallRequest = message as IPCMessages.PluginsUpgradeRequest;
        let version: string | undefined = msg.version;
        if (typeof version !== 'string' || version === 'latest' || !semver.valid(version)) {
            version = this._store.getLatestVersion(msg.name)?.version;
            if (version === undefined) {
                return response(new IPCMessages.PluginsUpgradeResponse({
                    error: this._logger.warn(`Fail to find suitable version`),
                })).catch((error: Error) => {
                    this._logger.warn(`Fail to send response on PluginsUpgradeResponse due error: ${error.message}`);
                });
            }
        }
        this.upgrade(msg.name, version).then(() => {
            response(new IPCMessages.PluginsUpgradeResponse({})).catch((error: Error) => {
                this._logger.warn(`Fail to send response on PluginsUpgradeResponse due error: ${error.message}`);
            });
        }).catch((addErr: Error) => {
            this._logger.warn(`Fail to delivery requested plugin "${msg.name}" due error: ${addErr.message}`);
            response(new IPCMessages.PluginsUpgradeResponse({
                error: addErr.message,
            })).catch((error: Error) => {
                this._logger.warn(`Fail to send response on PluginsUpgradeResponse due error: ${error.message}`);
            });
        });
    }

    private _ipc_PluginsUninstallRequest(message: IPCMessages.TMessage, response: (instance: any) => any) {
        const msg: IPCMessages.PluginsUninstallRequest = message as IPCMessages.PluginsUninstallRequest;
        this.remove(msg.name).then(() => {
            response(new IPCMessages.PluginsUninstallResponse({})).catch((error: Error) => {
                this._logger.warn(`Fail to send response on PluginsUninstallResponse due error: ${error.message}`);
            });
        }).catch((removeErr: Error) => {
            this._logger.warn(`Fail to prepare for remove plugin "${msg.name}" due error: ${removeErr.message}`);
            response(new IPCMessages.PluginsUninstallResponse({
                error: removeErr.message,
            })).catch((error: Error) => {
                this._logger.warn(`Fail to send response on PluginsUninstallResponse due error: ${error.message}`);
            });
        });
    }

    private _ipc_PluginAddRequest(message: IPCMessages.TMessage, response: (instance: any) => any) {
        const msg: IPCMessages.PluginAddRequest = message as IPCMessages.PluginAddRequest;
        const win = ServiceElectron.getBrowserWindow();
        if (win === undefined) {
            return response(new IPCMessages.PluginAddResponse({
                error: `Fail to find active browser window`,
            }));
        }
        dialog.showOpenDialog(win, {
            properties: ['openFile', 'showHiddenFiles'],
            filters: [
                {
                    name: 'Plugins',
                    extensions: ['tgz'],
                },
            ],
        }).then((returnValue: OpenDialogReturnValue) => {
            if (!(returnValue.filePaths instanceof Array) || returnValue.filePaths.length !== 1) {
                return response(new IPCMessages.PluginAddResponse({}));
            }
            const filename: string = returnValue.filePaths[0];
            const plugin: InstalledPlugin = new InstalledPlugin(filename, filename, this._store);
            plugin.import(filename).then(() => {
                plugin.read().then(() => {
                    plugin.delivery().then(() => {
                        response(new IPCMessages.PluginAddResponse({
                            name: plugin.getName(),
                        }));
                    }).catch((deliveryErr: Error) => {
                        response(new IPCMessages.PluginAddResponse({
                            error: this._logger.error(`Fail to delivery plugin due error: ${deliveryErr.message}`),
                        }));
                    });
                }).catch((pluginErr: Error | ErrorCompatibility) => {
                    if (pluginErr instanceof ErrorCompatibility) {
                        this._logger.warn(`Plugin "${plugin.getName()}" could not be used because compability: ${pluginErr.message}`);
                        response(new IPCMessages.PluginAddResponse({
                            error: this._logger.error(`Compability error: ${pluginErr.message}`),
                        }));
                    } else {
                        response(new IPCMessages.PluginAddResponse({
                            error: this._logger.warn(`Fail to read plugin data in "${plugin.getPath()}". Error: ${pluginErr.message}`),
                        }));
                    }
                });

            }).catch((impErr: Error) => {
                response(new IPCMessages.PluginAddResponse({
                    error: this._logger.error(`Error while importing plugin: ${impErr.message}`),
                }));
            });
        }).catch((error: Error) => {
            response(new IPCMessages.PluginAddResponse({
                error: this._logger.error(`Fail open file due error: ${error.message}`),
            }));
        });
    }

    private _filterDefault(tasks: IQueueTask[]): Promise<IQueueTask[]> {
        return new Promise((resolve, reject) => {
            const fullfilename: string = ServicePaths.getUninstalledDefaultPlugins();
            FS.exist(ServicePaths.getUninstalledDefaultPlugins()).then((exist: boolean) => {
                if (exist) {
                    FS.readTextFile(fullfilename).then((json: string) => {
                        const content: string[] = JSON.parse(json);
                        resolve(tasks.filter((task: IQueueTask) => !content.includes(task.name)));
                    });
                } else {
                    resolve(tasks);
                }
            }).catch((existErr: Error) => {
                reject(existErr.message);
            });
        });
    }

    private _loadSettings() {
        [   CSettingsAliases.PluginsUpdates,
            CSettingsAliases.PluginsUpgrades,
            CSettingsAliases.RemoveNotValid,
            CSettingsAliases.DefaultsPlugins].forEach((alias: CSettingsAliases) => {
            const setting: boolean | Error = ServiceSettings.get<boolean>(CSettingsEtries[alias].getFullPath());
            if (setting instanceof Error) {
                this._logger.warn(`Fail to load settings "${CSettingsEtries[alias].getFullPath()}" due error: ${setting.message}`);
            } else {
                this._settings[alias] = setting;
            }
        });
        if (ServiceEnv.get().CHIPMUNK_PLUGINS_NO_UPDATES) {
            this._settings.PluginsUpdates = false;
        }
        if (ServiceEnv.get().CHIPMUNK_PLUGINS_NO_UPGRADE) {
            this._settings.PluginsUpgrades = false;
        }
        if (ServiceEnv.get().CHIPMUNK_PLUGINS_NO_REMOVE_NOTVALID) {
            this._settings.RemoveNotValid = false;
        }
        if (ServiceEnv.get().CHIPMUNK_PLUGINS_NO_DEFAULTS) {
            this._settings.DefaultsPlugins = false;
        }
    }

}
/*
function error() {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            reject(new Error('1'))
        }, 2000);
    });
}

function ok() {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            resolve()
        }, 2000);
    });
}

function delay() {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            resolve()
        }, 4000);
    });
}
Promise.all([
    error().catch((err) => {
        console.log(`ERROR`);
    }).finally(() => {
        return delay();
    }),
    ok()
]).then(() => {
    console.log('all done');
}).catch((e) => {
    console.log('OPPPS');
});
*/
/*
function error() {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            reject(new Error('1'))
        }, 2000);
    });
}

function test() {
    return error().catch(() => {
        console.log('CATCH ERR');
    });
}

test().then(() => {
    console.log('OK');
})
*/
/*
function error() {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            reject(new Error('1'))
        }, 2000);
    });
}

const smth = error().catch(() => {
    console.log('ERROR');
}).finally(() => {
    console.log('FIN');
});

smth.then(() => {
    console.log('HERE');
})
*/
