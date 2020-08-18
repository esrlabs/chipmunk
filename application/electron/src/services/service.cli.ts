import * as IScheme from './service.storage.scheme';
import * as path from 'path';

import { StateFile } from '../classes/class.statefile';
import { IService } from '../interfaces/interface.service';
import { exist } from '../tools/fs';
import { CLIAction, TAction } from './cli/cli.action';
import { Actions} from './cli/cli.actions';
import { collect, sequences } from '../tools/sequences';
import { exec } from 'child_process';

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

    private readonly _pwdHookLeft: RegExp = /^pwd__:/gi;
    private readonly _pwdHookRight: RegExp = /__pwd$/gi;
    private _settings: StateFile<IScheme.IStorage> | undefined;
    private _logger: Logger = new Logger('ServiceCLI');
    private _pwd: string | undefined;
    private _executed: string | undefined;
    private _args: string[] = [];
    private _pendings: TAction[] = [];
    private _symbolic: string | undefined;

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
                this._getSymLinkPath().then((symbolic: string) => {
                    const sudo = require('sudo-prompt');
                    const options = {
                        name: 'Chipmunk Command Line Tool',
                    };
                    switch (process.platform) {
                        case 'win32':
                            sudo.exec(`mklink ${symbolic} ${ServicePaths.getCLI()}`, options, (error: NodeJS.ErrnoException | null | undefined, stdout: any, stderr: any) => {
                                if (error) {
                                    return reject(new Error(this._logger.warn(`Fail install command tool line due error: ${error.message}`)));
                                }
                                resolve();
                            });
                            break;
                        default:
                            sudo.exec(`ln -s ${ServicePaths.getCLI()} ${symbolic}`, options, (error: NodeJS.ErrnoException | null | undefined, stdout: any, stderr: any) => {
                                if (error) {
                                    return reject(new Error(this._logger.warn(`Fail install command tool line due error: ${error.message}`)));
                                }
                                resolve();
                            });
                            break;
                    }    
                }).catch(reject);
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
                this._getSymLinkPath().then((symbolic: string) => {
                    const sudo = require('sudo-prompt');
                    const options = {
                        name: 'Chipmunk Command Line Tool',
                    };
                    switch (process.platform) {
                        case 'win32':
                            sudo.exec(`del ${symbolic}`, options, (error: NodeJS.ErrnoException | null | undefined, stdout: any, stderr: any) => {
                                if (error) {
                                    return reject(new Error(this._logger.warn(`Fail uninstall command tool line due error: ${error.message}`)));
                                }
                                resolve();
                            });
                            break;
                        default:
                            sudo.exec(`rm ${symbolic}`, options, (error: NodeJS.ErrnoException | null | undefined, stdout: any, stderr: any) => {
                                if (error) {
                                    return reject(new Error(this._logger.warn(`Fail uninstall command tool line due error: ${error.message}`)));
                                }
                                resolve();
                            });
                            break;
                    }
                    }).catch(reject);
            }).catch(reject);
        });
    }

    public isInstalled(): Promise<boolean> {
        return new Promise((resolve, reject) => {
            this._getSymLinkPath().then((symbolic: string) => {
                exist(symbolic).then((res: boolean) => {
                    resolve(res);
                }).catch((err: Error) => {
                    this._logger.warn(`Fail to check file "${symbolic}" due error: ${err.message}`);
                    reject(err);
                });
    
            }).catch(reject);
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

    private _getSymLinkPath(): Promise<string> {
        return new Promise((resolve, reject) => {
            if (this._symbolic !== undefined) {
                return resolve(this._symbolic);
            }
            switch (process.platform) {
                case 'win32':
                    return exec(`echo %windir%`, (err, stdout: string, stderr: string) => {
                        if (err) {
                            return reject(`Fail to call echo %windir% on windows due error: ${err.message}.`);
                        }
                        if (stderr.trim() !== '') {
                            return reject(`Fail to call echo %windir% on windows due error: ${stderr}.`);
                        }
                        this._symbolic = `${stdout.replace(/[\n\r]/gi,'')}\\system32\\cm.exe`;
                        resolve( this._symbolic);
                    });
                default:
                    this._symbolic = `/usr/local/bin/cm`;
                    return resolve( this._symbolic);
            }
        });
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
            this._logger.debug(`Next arguments are available: ${source.join('; ')}`);
            const start = source.findIndex(arg => arg.indexOf('pwd__') === 0);
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
