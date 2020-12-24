import Logger from '../../tools/env.logger';
import ControllerPluginRender from './plugin.controller.render';

import InstalledPlugin from './plugin.installed';

import { ControllerSession } from '../../controllers/stream.main/controller';
import { IPCMessages } from '../../services/service.electron';
import { CommonInterfaces } from '../../interfaces/interface.common';

export { InstalledPlugin };

/**
 * @class ControllerPluginInstalled
 * @description Delivery default plugins into chipmunk folder
 */

export default class ControllerPluginsStorage {

    private _logger: Logger = new Logger('ControllerPluginsStorage');
    private _plugins: Map<string, InstalledPlugin> = new Map();

    public destroy(): Promise<void> {
        return new Promise((resolve) => {
            Promise.all(Array.from(this._plugins.values()).map((plugin: InstalledPlugin) => {
                return plugin.destroy();
            })).catch((error: Error) => {
                this._logger.warn(`Error on destroy of plugin's storage: ${error.message}`);
            }).finally(() => {
                this._plugins.clear();
                resolve();
            });
        });
    }

    public shutdown(): Promise<void> {
        return new Promise((resolve) => {
            Promise.all(Array.from(this._plugins.values()).map((plugin: InstalledPlugin) => {
                return plugin.shutdown();
            })).catch((error: Error) => {
                this._logger.warn(`Error on shutdown of plugin's storage: ${error.message}`);
            }).finally(() => {
                resolve();
            });
        });
    }

    public getPluginByName(name: string): InstalledPlugin | undefined {
        return Array.from(this._plugins.values()).find((plugin: InstalledPlugin) => {
            return plugin.getName() === name;
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

    public bindWithSession(session: ControllerSession): Promise<void> {
        return new Promise((resolve, reject) => {
            return Promise.all(Array.from(this._plugins.values()).map((plugin: InstalledPlugin) => {
                return plugin.bindWithSession(session).then((error: Error | undefined) => {
                    if (error instanceof Error) {
                        this._logger.debug(`Plugin "${plugin.getName()}" wouldn't be attached because: ${error.message}`);
                    }
                    return Promise.resolve();
                }).catch((bindErr: Error) => {
                    this._logger.warn(`Fail bind plugin ${plugin.getName()} with session "${session}" due error: ${bindErr.message}`);
                    this._logger.warn(`Plugin ${plugin.getName()} will be excluded.`);
                    this.exclude(plugin.getName()).catch((exclErr: Error) => {
                        this._logger.warn(`Fail exclude plugin ${plugin.getName()} due error: ${exclErr.message}`);
                    });
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
            plugins.push({
                name: plugin.getName(),
                location: controller.getEntrypoint() as string,
                token: plugin.getToken(),
                id: plugin.getId(),
                displayName: plugin.getDisplayName(),
            });
        });
        return plugins;
    }

    public runAllSingleProcess(): Promise<void> {
        return new Promise((resolve, reject) => {
            Promise.all(Array.from(this._plugins.values()).filter((plugin: InstalledPlugin) => {
                return plugin.isSingleProcess();
            }).map((plugin: InstalledPlugin) => {
                return (plugin.runAsSingle() as Promise<void>).catch((error: Error) => {
                    this._logger.warn(`Fail to run as single plugin ${plugin.getName()} due error: ${error}.`);
                    this.exclude(plugin.getName()).catch((exclErr: Error) => {
                        this._logger.warn(`Fail exclude plugin ${plugin.getName()} due error: ${exclErr.message}`);
                    });
                    return Promise.resolve();
                });
            })).then(() => {
                this._logger.debug(`Single process plugins running is done`);
                resolve();
            }).catch((error: Error) => {
                reject(error);
            });
        });
    }

    public getInstalled(): InstalledPlugin[] {
        return Array.from(this._plugins.values()).map((plugin: InstalledPlugin) => {
            return plugin;
        });
    }

    public include(plugin: InstalledPlugin) {
        this._plugins.set(plugin.getName(), plugin);
    }

    public exclude(name: string): Promise<void> {
        return new Promise((resolve, reject) => {
            const plugin: InstalledPlugin | undefined = this._plugins.get(name);
            if (plugin === undefined) {
                return reject(new Error(this._logger.warn(`Cannot exclude plugin "${name}" because it isn't found`)));
            }
            plugin.destroy().then(() => {
                this._logger.debug(`Plugin "${plugin.getName()}" was excluded.`);
                resolve();
            }).catch((error: Error) => {
                this._logger.debug(`Fail to correctly exclude plugin "${plugin.getName()}" due error: ${error.message}`);
            });
            this._plugins.delete(name);
        });
    }

    public logState() {
        this._logger.debug(`Next plugins are initialized:\n${Array.from(this._plugins.values()).map((plugin: InstalledPlugin) => {
            return `\t - ${plugin.getName()}`;
        }).join('\n')}`);
    }

}
