import * as IScheme from './service.storage.scheme';
import * as path from 'path';

import { StateFile } from '../classes/class.statefile';
import { IService } from '../interfaces/interface.service';
import { exist } from '../tools/fs';
import { CLIAction, TAction } from './cli/cli.action';
import { Actions} from './cli/cli.actions';
import { collect, sequences } from '../tools/sequences';

import guid from '../tools/tools.guid';
import Logger from '../tools/env.logger';
import ServiceProduction from './service.production';
import ServiceRenderState from './service.render.state';
import ServicePaths from './service.paths';
import ServiceElectron from './service.electron';

/**
 * @class ServiceCLI
 * @description Works with CLI
 */

class ServiceCLI implements IService {

    private readonly _pwdHookLeft: RegExp = /^pwd::/gi;
    private readonly _pwdHookRight: RegExp = /::pwd$/gi;
    private _settings: StateFile<IScheme.IStorage> | undefined;
    private _logger: Logger = new Logger('ServiceCLI');
    private _pwd: string | undefined;
    private _executed: string | undefined;
    private _args: string[] = [];
    private _pendings: TAction[] = [];

    public init(): Promise<void> {
        return new Promise((resolve) => {
            this._getPwd().then(() => {
                this._getActions().catch((err: Error) => {
                    this._logger.warn(`Fail get actions due error: ${err.message}`);
                }).finally(() => {
                    this._wait();
                    resolve();
                });
            }).catch((err: Error) => {
                this._logger.warn(err.message);
            }).finally(() => {
                ServiceRenderState.doOnReady(guid(), () => {
                    this._initMenu();
                });
                resolve();
            });
        });
    }

    public destroy(): Promise<void> {
        return new Promise((resolve) => {
            if (this._settings === undefined) {
                return resolve();
            }
            this._settings.destroy().then(resolve);
        });
    }

    public getName(): string {
        return 'ServiceCLI';
    }

    public install(): Promise<void> {
        return new Promise((resolve, reject) => {
            if (!ServiceProduction.isProduction()) {
                return resolve();
            }
            this.isInstalled().then((state: boolean) => {
                if (state) {
                    return resolve();
                }
                switch (process.platform) {
                    case 'win32':
                        break;
                    default:
                        const sudo = require('sudo-prompt');
                        const options = {
                            name: 'Chipmunk Command Line Tool',
                        };
                        sudo.exec(`ln -s ${ServicePaths.getCLI()} ${this._getSymLinkPath()}`, options, (error: NodeJS.ErrnoException | null | undefined, stdout: any, stderr: any) => {
                            if (error) {
                                return reject(new Error(this._logger.warn(`Fail install command tool line due error: ${error.message}`)));
                            }
                            resolve();
                        });
                        break;
                }
            }).catch(reject);
        });
    }

    public uninstall(): Promise<void> {
        return new Promise((resolve, reject) => {
            if (!ServiceProduction.isProduction()) {
                return resolve();
            }
            this.isInstalled().then((state: boolean) => {
                if (!state) {
                    return resolve();
                }
                switch (process.platform) {
                    case 'win32':
                        break;
                    default:
                        const sudo = require('sudo-prompt');
                        const options = {
                            name: 'Chipmunk Command Line Tool',
                        };
                        sudo.exec(`rm ${this._getSymLinkPath()}`, options, (error: NodeJS.ErrnoException | null | undefined, stdout: any, stderr: any) => {
                            if (error) {
                                return reject(new Error(this._logger.warn(`Fail uninstall command tool line due error: ${error.message}`)));
                            }
                            resolve();
                        });
                        break;
                }
            }).catch(reject);
        });
    }

    public isInstalled(): Promise<boolean> {
        return new Promise((resolve, reject) => {
            switch (process.platform) {
                case 'win32':
                    break;
                default:
                    const sl = this._getSymLinkPath();
                    exist(sl).then((res: boolean) => {
                        resolve(res);
                    }).catch((err: Error) => {
                        this._logger.warn(`Fail to check file "${sl}" due error: ${err.message}`);
                        reject(err);
                    });
                    break;
            }
        });
    }

    private _initMenu() {
        if (!ServiceProduction.isProduction()) {
            return;
        }
        this.isInstalled().then((state: boolean) => {
            if (state) {
                ServiceElectron.getMenu()?.add('File', [
                    { type: 'separator' },
                    { label: 'Uninstall Command Line Tool', click: () => {
                        this.uninstall().catch((err: Error) => this._logger.warn(err));
                    }},
                ]);
            } else {
                ServiceElectron.getMenu()?.add('File', [
                    { type: 'separator' },
                    { label: 'Install Command Line Tool', click: () => {
                        this.install().catch((err: Error) => this._logger.warn(err));
                    }},
                ]);
            }
        }).catch((err: Error) => {
            this._logger.warn(err);
        });
    }

    private _getSymLinkPath(): string {
        switch (process.platform) {
            case 'win32':
                return '';
            default:
                return `/usr/local/bin/cm`;
        }
    }

    private _getArgs(): string[] {
        if (ServiceProduction.isProduction()) {
            return process.argv;
        } else {
            return [];
        }
    }

    private _getPwd(): Promise<void> {
        return new Promise((resolve, reject) => {
            const source = this._getArgs();
            const start = source.findIndex(arg => arg.indexOf('pwd::') === 0);
            if (start === -1) {
                return reject(new Error(`Fail to find pwd`));
            }
            const args: string[] = source.slice(start, source.length);
            if (args.length === 2) {
                return reject(new Error('Expected more than 2 arguments'));
            }
            const pwd: string = args[0].replace(this._pwdHookLeft, '').replace(this._pwdHookRight, '');
            exist(path.resolve(pwd)).then((valid: boolean) => {
                if (!valid) {
                    this._logger.warn(`Pwd directory doesn't exist. Probably permissions issue.`);
                    return resolve();
                }
                this._pwd = pwd;
                this._executed = args[1];
                this._args = args.slice(2, args.length);
                resolve();
            }).catch((err: Error) => {
                reject(new Error(`Fail get pwd param due error: ${err.message}`));
            });
        });
    }

    private _getActions(): Promise<void> {
        return new Promise((resolve, reject) => {
            if (this._pwd === undefined) {
                return resolve();
            }
            const pwd: string = this._pwd;
            collect<TAction | undefined>(Actions.map((Action: any) => {
                const action: CLIAction = new Action();
                return () => {
                    const args = this._args.slice();
                    this._args = action.clear(this._args);
                    return action.getTask(pwd, args);
                };
            }), (action: TAction | undefined) => {
                if (action === undefined) {
                    return;
                }
                this._pendings.push(action);
            }, false).catch(reject).finally(resolve);
        });
    }

    private _wait() {
        if (this._pendings.length === 0) {
            return;
        }
        ServiceRenderState.doOnReady(guid(), () => {
            sequences(this._pendings, false).catch((err: Error) => {
                this._logger.warn(`Fail start CLI actions due error: ${err.message}`);
            });
        });
    }

}

export default (new ServiceCLI());
