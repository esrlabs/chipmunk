import * as Toolkit from 'chipmunk.client.toolkit';

import { IService } from '../interfaces/interface.service';
import { CommonInterfaces } from '../interfaces/interface.common';
import { IPC } from './service.electron.ipc';

import ElectronIpcService from './service.electron.ipc';

export interface IElectronEnv {
    showOpenDialog: (
        options: CommonInterfaces.Electron.OpenDialogOptions,
    ) => Promise<CommonInterfaces.Electron.OpenDialogReturnValue>;
    openExternal: (url: string) => Promise<void>;
    platform: () => Promise<string>;
}

declare var window: any;

export class ElectronEnvService implements IService {
    private _logger: Toolkit.Logger = new Toolkit.Logger('ElectronEnvService');
    private _module: any;

    constructor() {
        if ((window as any) === undefined || typeof (window as any).require !== 'function') {
            this._logger.error(`"window" object isn't available or "require" function isn't found`);
            return;
        }
        const mod = (window as any).require('electron');
        if (mod === undefined) {
            this._logger.error(`Fail to get access to "electron" module.`);
            return;
        }
        this._module = mod;
    }

    public init(): Promise<void> {
        if (this._module === undefined) {
            return Promise.reject(this._logger.error(`Fail to get access to "electron" module.`));
        }
        return Promise.resolve();
    }

    public getName(): string {
        return 'ElectronEnvService';
    }

    public get(): IElectronEnv {
        const self = this;
        return {
            showOpenDialog: (
                options: CommonInterfaces.Electron.OpenDialogOptions,
            ): Promise<CommonInterfaces.Electron.OpenDialogReturnValue> => {
                return new Promise((resolve, reject) => {
                    ElectronIpcService.request<IPC.ElectronEnvShowOpenDialogResponse>(
                        new IPC.ElectronEnvShowOpenDialogRequest({
                            options: options,
                        }),
                        IPC.ElectronEnvShowOpenDialogResponse,
                    )
                        .then((message) => {
                            if (message.error !== undefined) {
                                return reject(
                                    new Error(
                                        self._logger.warn(
                                            `Cannot call ShowOpenDialog due error: ${message.error}`,
                                        ),
                                    ),
                                );
                            }
                            if (message.result === undefined) {
                                return reject(
                                    new Error(
                                        self._logger.warn(
                                            `ElectronEnvShowOpenDialogResponse didn't return any results`,
                                        ),
                                    ),
                                );
                            }
                            resolve(message.result);
                        })
                        .catch((err: Error) => {
                            reject(
                                new Error(
                                    self._logger.warn(
                                        `Fail to call ShowOpenDialog due error: ${err.message}`,
                                    ),
                                ),
                            );
                        });
                });
            },
            openExternal: (url: string): Promise<void> => {
                return new Promise((resolve, reject) => {
                    ElectronIpcService.request<IPC.ElectronEnvShellOpenExternalResponse>(
                        new IPC.ElectronEnvShellOpenExternalRequest({
                            url: url,
                        }),
                        IPC.ElectronEnvShellOpenExternalResponse,
                    )
                        .then((message) => {
                            if (message.error !== undefined) {
                                return reject(
                                    new Error(
                                        self._logger.warn(
                                            `Cannot call OpenExternal due error: ${message.error}`,
                                        ),
                                    ),
                                );
                            }
                            resolve(undefined);
                        })
                        .catch((err: Error) => {
                            reject(
                                new Error(
                                    self._logger.warn(
                                        `Fail to call OpenExternal due error: ${err.message}`,
                                    ),
                                ),
                            );
                        });
                });
            },
            platform: (): Promise<string> => {
                return new Promise((resolve, reject) => {
                    ElectronIpcService.request<IPC.ElectronEnvPlatformResponse>(
                        new IPC.ElectronEnvPlatformRequest(),
                        IPC.ElectronEnvPlatformResponse,
                    )
                        .then((message) => {
                            resolve(message.platform);
                        })
                        .catch((err: Error) => {
                            reject(
                                new Error(
                                    self._logger.warn(
                                        `Fail to call OpenExternal due error: ${err.message}`,
                                    ),
                                ),
                            );
                        });
                });
            },
        };
    }
}

export default new ElectronEnvService();
