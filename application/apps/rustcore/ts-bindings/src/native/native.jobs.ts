/* eslint-disable @typescript-eslint/no-unused-vars */
import * as Logs from '../util/logging';

import { getNativeModule } from './native';

export abstract class JobsNative {
    public abstract abort(operationUuid: string): Promise<void>;

    public abstract init(): Promise<void>;

    public abstract destroy(): Promise<void>;

    public abstract jobCancelTest(
        uuid: (uuid: string) => void,
        num_a: number,
        num_b: number,
    ): Promise<number>;
}

export class Jobs {
    private readonly _logger: Logs.Logger = Logs.getLogger(`Jobs`);
    private readonly _native: JobsNative;

    constructor() {
        this._native = new (getNativeModule().Jobs)() as JobsNative;
        this._logger.debug(`Rust Jobs native session is created`);
    }

    public async init(): Promise<void> {
        return new Promise((resolve, reject) => {
            this._native
                .init()
                .then(() => {
                    this._logger.debug(`Rust Jobs native session is inited`);
                    resolve();
                })
                .catch((err: Error) => {
                    this._logger.error(
                        `Fail to init Jobs session: ${err instanceof Error ? err.message : err}`,
                    );
                    console.log(err);
                    reject(err);
                });
        });
    }

    public async destroy(): Promise<void> {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                this._logger.error(`Timeout error. Session wasn't closed in 5 sec.`);
                reject(new Error(`Timeout error. Session wasn't closed in 5 sec.`));
            }, 5000);
            this._native
                .destroy()
                .then(() => {
                    this._logger.debug(`Session has been destroyed`);
                    resolve();
                })
                .catch((err: Error) => {
                    this._logger.error(
                        `Fail to close session due error: ${
                            err instanceof Error ? err.message : err
                        }`,
                    );
                    console.log(err);
                    reject(err);
                })
                .finally(() => {
                    clearTimeout(timeout);
                });
        });
    }

    public async abort(uuid: string): Promise<void> {
        return new Promise((resolve, reject) => {
            this._native
                .abort(uuid)
                .then(resolve)
                .catch((err: Error) => {
                    this._logger.error(
                        `Fail to abort operation due error: ${
                            err instanceof Error ? err.message : err
                        }`,
                    );
                    console.log(err);
                    reject(err);
                });
        });
    }

    public async jobCancelTest(
        uuid: (uuid: string) => void,
        num_a: number,
        num_b: number,
    ): Promise<number> {
        return new Promise((resolve, reject) => {
            this._native
                .jobCancelTest(uuid, num_a, num_b)
                .then(resolve)
                .catch((err: Error) => {
                    this._logger.error(
                        `Fail to do "some" operation due error: ${
                            err instanceof Error ? err.message : err
                        }`,
                    );
                    console.log(err);
                    reject(err);
                });
        });
    }
}
