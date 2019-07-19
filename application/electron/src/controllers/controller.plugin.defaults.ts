import * as path from 'path';
import * as FS from '../tools/fs';
import * as tar from 'tar';
import Logger from '../tools/env.logger';
import ServicePaths from '../services/service.paths';
import ControllerPluginVersions from './controller.plugin.versions';

export interface IPluginDefaultInfo {
    name: string;
    platform: string;
    version: string;
    tgz: string;
}

/**
 * @class ControllerPluginDefaults
 * @description Delivery default plugins into logviewer folder
 */

export default class ControllerPluginDefaults {

    private _logger: Logger = new Logger('ControllerPluginDefaults');
    private _plugins: IPluginDefaultInfo[] = [];

    public delivery(plugins: IPluginDefaultInfo[]): Promise<void> {
        return new Promise((resolve, reject) => {
            // Unpack and delivery each plugin
            Promise.all(plugins.map((plugin: IPluginDefaultInfo) => {
                return new Promise((resolvePlugin, rejectPlugin) => {
                    this._unpack(plugin.tgz).then((dest: string) => {
                        this._logger.env(`Default plugin "${plugin.name}@${plugin.version}" is delivered to: ${dest}.`);
                        resolvePlugin();
                    }).catch((pluginError: Error) => {
                        rejectPlugin(new Error(this._logger.error(`Fail to delivery default plugin "${plugin.name}@${plugin.version}" due error: ${pluginError.message}.`)));
                    });
                });
            })).then(() => {
                if (plugins.length > 0) {
                    this._logger.env(`${plugins.length} default plugin(s) are delivered.`);
                }
                resolve();
            }).catch(reject);
        });
    }

    public getAll(): Promise<IPluginDefaultInfo[]> {
        return new Promise((resolve) => {
            if (this._plugins.length > 0) {
                return resolve(this._plugins);
            }
            const plugins: IPluginDefaultInfo[] = [];
            FS.readFolder(ServicePaths.getDefaultPlugins(), FS.EReadingFolderTarget.files).then((defaultPlugins: string[]) => {
                if (defaultPlugins.length === 0) {
                    return resolve([]);
                }
                // Extract info objects
                defaultPlugins.forEach((pluginFile: string) => {
                    const info: IPluginDefaultInfo | undefined = this._getPluginInfo(pluginFile);
                    if (info === undefined) {
                        return;
                    }
                    if (info.platform !== process.platform.toLowerCase()) {
                        return;
                    }
                    plugins.push(info);
                    this._plugins.push(Object.assign({}, info));
                });
                resolve(plugins);
            }).catch((defPluginsFolderReadingError: Error) => {
                this._logger.warn(`Fail to get list of default plugins due error: ${defPluginsFolderReadingError.message}`);
                resolve([]);
            });
        });
    }

    private _getPluginInfo(filename: string): IPluginDefaultInfo | undefined {
        const extname: string = path.extname(filename).replace('.', '').toLowerCase();
        const basename: string = path.basename(filename);
        if (extname !== 'tgz') {
            return undefined;
        }
        // Format name of plugin: xterminal.sdfd@0.0.1-mac.tgz
        // In name of plugin allowed: \d \w \. and -
        const matches: RegExpMatchArray | null = /([\w\.\d-]*)@(\d{1,}\.\d{1,}\.\d{1,})-(\w*)\.tgz/gi.exec(basename);
        if (matches === null || matches.length !== 4) {
            this._logger.warn(`Included plugin "${filename}" has not valid name.`);
            return undefined;
        }
        const versionErr: Error | undefined = ControllerPluginVersions.getVersionError(matches[2]);
        if (versionErr instanceof Error) {
            this._logger.warn(`Included plugin "${filename}" has invalid version defintion: ${versionErr.message}.`);
            return undefined;
        }
        return {
            name: matches[1],
            version: matches[2],
            platform: matches[3],
            tgz: path.resolve(ServicePaths.getDefaultPlugins(), filename),
        };
    }

    private _unpack(tgzfile: string): Promise<string> {
        return new Promise((resolve, reject) => {
            tar.x({
                file: tgzfile,
                cwd: ServicePaths.getPlugins(),
            }).then(() => {
                resolve(ServicePaths.getPlugins());
            }).catch(reject);
        });
    }

}
