import {
    SetupService,
    Interface,
    Implementation,
    register,
    DependOn,
} from 'platform/entity/service';
import { services } from '@register/services';
import { electron } from '@service/electron';
import { storage } from '@service/storage';
import { envvars } from '@loader/envvars';
import { CancelablePromise } from 'platform/env/promise';
import { Storage } from './env/storage';
import { error } from 'platform/log/utils';

import * as fs from 'fs';
import * as os from 'os';
import * as Requests from 'platform/ipc/request';

@DependOn(electron)
@DependOn(storage)
@SetupService(services['env'])
export class Service extends Implementation {
    protected cwd: Map<string, string> = new Map();
    protected readonly storage: Storage = new Storage();

    public override ready(): Promise<void> {
        this.register(
            electron
                .ipc()
                .respondent(
                    this.getName(),
                    Requests.Cwd.Set.Request,
                    (
                        request: Requests.Cwd.Set.Request,
                    ): CancelablePromise<Requests.Cwd.Set.Response> => {
                        return new CancelablePromise(async (resolve, _reject) => {
                            const err: Error | undefined = await this._isFolder(request.cwd);
                            if (err instanceof Error) {
                                return resolve(
                                    new Requests.Cwd.Set.Response({
                                        uuid: request.uuid,
                                        error: err.message,
                                    }),
                                );
                            }
                            try {
                                const globalCwd = await this.storage.get().cwd();
                                if (request.uuid === undefined || globalCwd === os.homedir()) {
                                    await this.setGlobal(request.cwd);
                                } else {
                                    this.cwd.set(request.uuid, request.cwd);
                                }
                                resolve(
                                    new Requests.Cwd.Set.Response({
                                        uuid: request.uuid,
                                        error: undefined,
                                    }),
                                );
                            } catch (e) {
                                resolve(
                                    new Requests.Cwd.Set.Response({
                                        uuid: request.uuid,
                                        error: error(e),
                                    }),
                                );
                            }
                        });
                    },
                ),
        );
        this.register(
            electron
                .ipc()
                .respondent(
                    this.getName(),
                    Requests.Cwd.Get.Request,
                    (
                        request: Requests.Cwd.Get.Request,
                    ): CancelablePromise<Requests.Cwd.Get.Response> => {
                        return new CancelablePromise(async (resolve, _reject) => {
                            const cwd =
                                request.uuid === undefined ? undefined : this.cwd.get(request.uuid);
                            try {
                                const globalCwd = await this.storage.get().cwd();
                                resolve(
                                    new Requests.Cwd.Get.Response({
                                        uuid: request.uuid,
                                        cwd:
                                            cwd === undefined
                                                ? globalCwd === undefined
                                                    ? os.homedir()
                                                    : globalCwd
                                                : cwd,
                                    }),
                                );
                            } catch (e) {
                                resolve(
                                    new Requests.Cwd.Get.Response({
                                        uuid: request.uuid,
                                        cwd: cwd === undefined ? os.homedir() : cwd,
                                    }),
                                );
                            }
                        });
                    },
                ),
        );
        this.register(
            electron
                .ipc()
                .respondent(
                    this.getName(),
                    Requests.Env.Get.Request,
                    (
                        _request: Requests.Env.Get.Request,
                    ): CancelablePromise<Requests.Env.Get.Response> => {
                        return new CancelablePromise(async (resolve, _reject) => {
                            resolve(
                                new Requests.Env.Get.Response({
                                    env: await this.getEnvVars(),
                                    error: undefined,
                                }),
                            );
                        });
                    },
                ),
        );
        this.register(
            electron
                .ipc()
                .respondent(
                    this.getName(),
                    Requests.Env.Set.Request,
                    (
                        request: Requests.Env.Set.Request,
                    ): CancelablePromise<Requests.Env.Set.Response> => {
                        return new CancelablePromise(async (resolve, _reject) => {
                            await this.storage
                                .set()
                                .envvars(request.env)
                                .catch((err: Error) => {
                                    this.log().error(`Error to write storage: ${err.message}`);
                                });
                            resolve(
                                new Requests.Env.Set.Response({
                                    error: undefined,
                                }),
                            );
                        });
                    },
                ),
        );
        return Promise.resolve();
    }

    public override destroy(): Promise<void> {
        this.unsubscribe();
        return Promise.resolve();
    }

    public async setGlobal(path: string): Promise<Error | undefined> {
        const error: Error | undefined = await this._isFolder(path);
        if (error instanceof Error) {
            return error;
        }
        await this.storage
            .set()
            .cwd(path)
            .catch((err: Error) => {
                this.log().error(`Error to write storage: ${err.message}`);
            });
        return undefined;
    }

    public async getEnvVars(): Promise<{ [key: string]: string }> {
        const injected = await this.storage
            .get()
            .envvars()
            .catch((err: Error) => {
                this.log().error(`Error to write storage: ${err.message}`);
            });
        const os = Object.assign({}, envvars.getOS()) as { [key: string]: string };
        return Object.assign(os, injected === undefined ? {} : injected);
    }

    private _isFolder(path: string): Promise<Error | undefined> {
        return new Promise((resolve) => {
            fs.promises
                .stat(path)
                .then((stat) => {
                    if (!stat.isDirectory()) {
                        resolve(new Error(`${path} isn't a directory`));
                        return;
                    }
                    resolve(undefined);
                })
                .catch(resolve);
        });
    }
}
export interface Service extends Interface {}
export const env = register(new Service());
