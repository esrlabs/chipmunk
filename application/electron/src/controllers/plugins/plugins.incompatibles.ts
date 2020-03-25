import Logger from '../../tools/env.logger';

import InstalledPlugin from './plugin.installed';

/**
 * @class ControllerPluginsIncompatiblesStorage
 * @description Delivery default plugins into chipmunk folder
 */

export default class ControllerPluginsIncompatiblesStorage {

    private _logger: Logger = new Logger('ControllerPluginsIncompatiblesStorage');
    private _plugins: Map<string, InstalledPlugin> = new Map();

    public destroy(): Promise<void> {
        return new Promise((resolve) => {
            this._plugins.clear();
            resolve();
        });
    }

    public get(): InstalledPlugin[] {
        return Array.from(this._plugins.values()).map((plugin: InstalledPlugin) => {
            return plugin;
        });
    }

    public add(plugin: InstalledPlugin) {
        this._plugins.set(plugin.getName(), plugin);
    }

    public delete(name: string): void {
        this._plugins.delete(name);
    }

}
