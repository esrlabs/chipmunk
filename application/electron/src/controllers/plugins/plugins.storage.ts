// tslint:disable: max-classes-per-file

import * as path from 'path';
import * as FS from '../../tools/fs';

import Logger from '../../tools/env.logger';
import ServicePaths from '../../services/service.paths';
import ControllerPluginRender from './plugin.controller.render';

import InstalledPlugin, { TConnectionFactory } from './plugin.installed';
import ControllerPluginStore, { IPluginReleaseInfo } from './plugins.store';

import { IPCMessages } from '../../services/service.electron';

export { InstalledPlugin, TConnectionFactory };

/**
 * @class ControllerPluginInstalled
 * @description Delivery default plugins into logviewer folder
 */

export default class ControllerPluginsStorage {

    private _logger: Logger = new Logger('ControllerPluginsStorage');
    private _path: string = ServicePaths.getPlugins();
    private _plugins: Map<string, InstalledPlugin> = new Map();
    private _store: ControllerPluginStore;

    constructor(store: ControllerPluginStore) {
        this._store = store;
    }

    public destroy(): Promise<void> {
        return new Promise((resolve) => {
            Promise.all(Array.from(this._plugins.values()).map((plugin: InstalledPlugin) => {
                return plugin.destroy();
            })).catch((error: Error) => {
                this._logger.warn(`Error on destroy of plugin's storage: ${error.message}`);
            }).finally(() => {
                resolve();
            });
        });
    }

    public getPluginById(id: number): InstalledPlugin | undefined {
        return Array.from(this._plugins.values()).find((plugin: InstalledPlugin) => {
            return plugin.getId() === id;
        });
    }

    public getPluginByToken(token: string): InstalledPlugin | undefined {
        return Array.from(this._plugins.values()).find((plugin: InstalledPlugin) => {
            return plugin.getToken() === token;
        });
    }

    public bindWithSession(session: string, connectionFactory: TConnectionFactory): Promise<void> {
        return new Promise((resolve, reject) => {
            return Promise.all(Array.from(this._plugins.values()).map((plugin: InstalledPlugin) => {
                return plugin.bindWithSession(session, connectionFactory).catch((bindErr: Error) => {
                    this._logger.warn(`Fail bind plugin ${plugin.getName()} with session "${session}" due error: ${bindErr.message}`);
                    return Promise.resolve();
                });
            })).then(() => {
                resolve();
            }).catch((error: Error) => {
                reject(error);
            });
        });
    }

    public unbindWithSession(session: string): Promise<void> {
        return new Promise((resolve, reject) => {
            return Promise.all(Array.from(this._plugins.values()).map((plugin: InstalledPlugin) => {
                return plugin.unbindWithSession(session).catch((bindErr: Error) => {
                    this._logger.warn(`Fail unbind plugin ${plugin.getName()} with session "${session}" due error: ${bindErr.message}`);
                    return Promise.resolve();
                });
            })).then(() => {
                resolve();
            }).catch((error: Error) => {
                reject(error);
            });
        });
    }

    public getNamesOfInstalled(): string[] {
        return Array.from(this._plugins.values()).map((plugin: InstalledPlugin) => {
            return plugin.getName();
        });
    }

    public getPluginRendersInfo(): IPCMessages.IRenderMountPluginInfo[] {
        const plugins: IPCMessages.IRenderMountPluginInfo[] = [];
        this._plugins.forEach((plugin: InstalledPlugin) => {
            const controller: ControllerPluginRender | undefined = plugin.getRenderController();
            if (controller === undefined || controller.getEntrypoint() === undefined) {
                return;
            }
            return {
                name: plugin.getName(),
                location: controller.getEntrypoint(),
                token: plugin.getToken(),
                id: plugin.getId(),
            };
        });
        return plugins;
    }

    public read(): Promise<void> {
        return new Promise((resolve, reject) => {
            // Get all sub folders from plugins folder. Expecting: there are plugins folders
            FS.readFolders(this._path).then((folders: string[]) => {
                if (folders.length === 0) {
                    // No any plugins
                    this._logger.debug(`No any plugins were found. Target folder: ${this._path}`);
                    return resolve();
                }
                const toBeRemoved: InstalledPlugin[] = [];
                // Check each plugin folder and read package.json of render and process apps
                Promise.all(folders.map((folder: string) => {
                    const plugin: InstalledPlugin = new InstalledPlugin(folder, path.resolve(this._path, folder), this._store);
                    return plugin.read().then(() => {
                        this._plugins.set(plugin.getName(), plugin);
                    }).catch((pluginErr: Error) => {
                        this._logger.warn(`Fail to read plugin data in "${folder}". Plugin will be ignored. Error: ${pluginErr.message}`);
                        toBeRemoved.push(plugin);
                        return Promise.resolve();
                    });
                })).catch((readErr: Error) => {
                    this._logger.warn(`Error during reading plugins: ${readErr.message}`);
                }).finally(() => {
                    Promise.all(toBeRemoved.map((plugin: InstalledPlugin) => {
                        return plugin.remove().then(() => {
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
                });
            }).catch((error: Error) => {
                this._logger.error(`Fail to read plugins folder (${this._path}) due error: ${error.message}.`);
                resolve();
            });
        });
    }

    public update(): Promise<void> {
        return new Promise((resolve, reject) => {
            this._logger.debug(`Updating of installed plugins is started`);
            Promise.all(Array.from(this._plugins.values()).map((plugin: InstalledPlugin) => {
                return plugin.update().catch((updateErr: Error) => {
                    this._logger.warn(`Fail to update plugin "${plugin.getName()}" due error: ${updateErr.message}`);
                    return Promise.resolve();
                });
            })).then(() => {
                this._logger.debug(`Updating of installed plugins is finished`);
                resolve();
            }).catch((error: Error) => {
                reject(new Error(this._logger.warn(`Fail to update plugins due error: ${error.message}`)));
            });
        });
    }

    public defaults(): Promise<void> {
        return new Promise((resolve) => {
            const installed: string[] = Array.from(this._plugins.values()).map((plugin: InstalledPlugin) => {
                return plugin.getName();
            }).filter((name: string | undefined) => {
                return name !== undefined;
            });
            const plugins: IPluginReleaseInfo[] = this._store.getDefaults(installed);
            if (plugins.length === 0) {
                return resolve();
            }
            Promise.all(plugins.map((info: IPluginReleaseInfo) => {
                const plugin: InstalledPlugin = new InstalledPlugin(info.name, path.resolve(this._path, info.name), this._store);
                return plugin.install().then(() => {
                    this._plugins.set(info.name, plugin);
                }).catch((installErr: Error) => {
                    this._logger.warn(`Fail to isntall plugin "${info.name}" due error: ${installErr.message}`);
                    return Promise.resolve();
                });
            })).catch((error: Error) => {
                this._logger.warn(`Error during installation of plugins: ${error.message}`);
            }).finally(() => {
                resolve();
            });
        });
    }

    public runAllSingleProcess(): Promise<void> {
        return new Promise((resolve, reject) => {
            Promise.all(Array.from(this._plugins.values()).filter((plugin: InstalledPlugin) => {
                return plugin.isSingleProcess();
            }).map((plugin: InstalledPlugin) => {
                return plugin.runAsSingle() as Promise<void>;
            })).then(() => {
                this._logger.debug(`Single process plugins running is done`);
                resolve();
            }).catch((error: Error) => {
                reject(error);
            });
        });
    }

    public logState() {
        this._logger.debug(`Next plugins are available:\n${Array.from(this._plugins.values()).map((plugin: InstalledPlugin) => {
            return `\t - ${plugin.getName()}`;
        }).join('\n')}`);
    }

}
