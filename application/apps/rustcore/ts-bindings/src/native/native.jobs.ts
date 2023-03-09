/* eslint-disable @typescript-eslint/no-unused-vars */
import * as Logs from '../util/logging';

import { CancelablePromise } from 'platform/env/promise';
import { error } from 'platform/env/logger';
import { getNativeModule } from './native';

export abstract class JobsNative {
    public abstract abort(operationUuid: string): Promise<void>;

    public abstract init(): Promise<void>;

    public abstract destroy(): Promise<void>;

    public abstract jobCancelTest(
        uuid: (uuid: string) => void,
        num_a: number,
        num_b: number,
    ): Promise<string>;

    public abstract listFolderContent(
        uuid: (uuid: string) => void,
        path: string,
    ): Promise<string>;
}

export type JobResult<T> = { Finished: T } | 'Cancelled';

export class Jobs {
    private readonly _logger: Logs.Logger = Logs.getLogger(`Jobs`);
    private readonly _native: JobsNative;

    constructor() {
        this._native = new (getNativeModule().UnboundJobs)() as JobsNative;
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
                    reject(err);
                });
        });
    }

    // This method is an example of wrapped into CancelablePromise job
    public jobCancelTest(num_a: number, num_b: number): CancelablePromise<number> {
        const job = this.execute(
            // We should define validation callback. As argument it takes result of job,
            // which should be checked for type. In case it type is correct, callback
            // should return true
            (res: number): boolean => {
                return typeof res === 'number';
            },
            // As second argument of executor we should provide native function of job.
            this._native.jobCancelTest(
                (uuid: string) => {
                    // To make cancalation possible we should emit event "uuid" in the
                    // scope of CancelablePromise. This function should be used for all
                    // jobs in same way.
                    job.emit('uuid', uuid);
                },
                num_a,
                num_b,
            ),
        );
        return job;
    }

    public jobListContent(path: string): CancelablePromise<string> {
        const job = this.execute(
            // We should define validation callback. As argument it takes result of job,
            // which should be checked for type. In case it type is correct, callback
            // should return true
            (res: string): boolean => {
                return typeof res === 'string';
            },
            // As second argument of executor we should provide native function of job.
            this._native.listFolderContent(
                (uuid: string) => {
                    // To make cancalation possible we should emit event "uuid" in the
                    // scope of CancelablePromise. This function should be used for all
                    // jobs in same way.
                    console.log("in JS listFolderContent for " + uuid);
                    job.emit('uuid', uuid);
                },
                path,
            ),
        );
        return job;
    }

    protected execute<T>(
        validate: (result: T) => boolean,
        task: Promise<string>,
    ): CancelablePromise<T> {
        return new CancelablePromise((resolve, reject, cancel, refCancel, self) => {
            let jobUuid: string | undefined;
            refCancel(() => {
                if (jobUuid === undefined) {
                    // Cancelation will be started as soon as UUID of operation will be gotten
                    return;
                }
                this.abort(jobUuid).catch((err: Error) => {
                    this._logger.error(`Fail to cancel ${error(err)}`);
                });
            });
            self.on('uuid', (uuid: string) => {
                jobUuid = uuid;
                if (self.isCanceling()) {
                    this.abort(jobUuid).catch((err: Error) => {
                        this._logger.error(`Fail to cancel ${error(err)}`);
                    });
                }
            });
            task.then((income: string) => {
                try {
                    const result: JobResult<T> = JSON.parse(income);
                    if (result === 'Cancelled') {
                        cancel();
                    } else if (validate(result.Finished)) {
                        resolve(result.Finished);
                    } else {
                        reject(new Error(`Fail to parse results: ${income}`));
                    }
                } catch (e) {
                    reject(new Error(`Fail to parse results (${income}): ${error(e)}`));
                }
            }).catch((err: Error) => {
                this._logger.error(`Fail to do "some" operation due error: ${error(err)}`);
                reject(new Error(error(err)));
            });
        });
    }
}
