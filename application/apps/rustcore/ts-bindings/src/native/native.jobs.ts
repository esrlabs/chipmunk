import { Logger } from 'platform/log';
import { scope } from 'platform/env/scope';
import { CancelablePromise } from 'platform/env/promise';
import { error } from 'platform/log/utils';
import { getNativeModule } from '../native/native';
import { NativeError } from '../interfaces/errors';

export abstract class JobsNative {
    public abstract abort(sequence: number): Promise<void>;

    public abstract init(): Promise<void>;

    public abstract destroy(): Promise<void>;

    public abstract isFileBinary(sequence: number, filePath: string): Promise<Uint8Array>;

    public abstract jobCancelTest(
        sequence: number,
        num_a: number,
        num_b: number,
    ): Promise<Uint8Array>;

    public abstract listFolderContent(
        sequence: number,
        depth: number,
        max: number,
        paths: string[],
        includeFiles: boolean,
        includeFolders: boolean,
    ): Promise<Uint8Array>;

    public abstract spawnProcess(
        sequence: number,
        path: string,
        args: string[],
    ): Promise<Uint8Array>;
    public abstract getFileChecksum(sequence: number, path: string): Promise<Uint8Array>;
    public abstract getDltStats(sequence: number, files: string[]): Promise<Uint8Array>;
    public abstract getSomeipStatistic(sequence: number, files: string[]): Promise<Uint8Array>;
    public abstract getShellProfiles(sequence: number): Promise<Uint8Array>;
    public abstract getContextEnvvars(sequence: number): Promise<Uint8Array>;
    public abstract getSerialPortsList(sequence: number): Promise<Uint8Array>;
    public abstract sleep(sequence: number, ms: number): Promise<Uint8Array>;
    public abstract getRegexError(
        sequence: number,
        filter: {
            value: string;
            is_regex: boolean;
            ignore_case: boolean;
            is_word: boolean;
            invert: boolean;
        },
    ): Promise<Uint8Array>;
    public abstract installedPluginsList(sequence: number): Promise<Uint8Array>;
    public abstract invalidPluginsList(sequence: number): Promise<Uint8Array>;
    public abstract installedPluginsPaths(sequence: number): Promise<Uint8Array>;
    public abstract invalidPluginsPaths(sequence: number): Promise<Uint8Array>;
    public abstract installedPluginsInfo(
        sequence: number,
        plugin_path: string,
    ): Promise<Uint8Array>;
    public abstract invalidPluginsInfo(sequence: number, plugin_path: string): Promise<Uint8Array>;
    public abstract getPluginRunData(sequence: number, plugin_path: string): Promise<Uint8Array>;
    public abstract reloadPlugins(sequence: number): Promise<Uint8Array>;
    public abstract addPlugin(sequence: number, plugin_path: string): Promise<Uint8Array>;
    public abstract removePlugin(sequence: number, plugin_path: string): Promise<Uint8Array>;
}

interface Job {
    started: number;
    alias: string;
}

export class Queue {
    protected jobs: Map<number, Job> = new Map();
    private _sequence: number = 0;

    public add(sequence: number, alias: string): void {
        this.jobs.set(sequence, {
            started: Date.now(),
            alias,
        });
    }

    public remove(sequence: number): void {
        this.jobs.delete(sequence);
    }

    public sequence(): number {
        return ++this._sequence;
    }
}

export type JobResult<T> = { Finished: T } | 'Cancelled';

export type ConvertCallback<Output> = (input: Uint8Array) => Output | Error | Cancelled;

enum State {
    destroyed,
    destroying,
    inited,
    created,
}

export class Cancelled extends Error {}

export function decode<Output>(
    buf: Uint8Array,
    decoder: (buf: Uint8Array) => any,
): Output | Error | Cancelled {
    try {
        const output = decoder(buf);
        if (output === 'Cancelled') {
            return new Cancelled(`Job has been cancelled`);
        } else if ('Finished' in output) {
            return output.Finished as Output;
        } else {
            return new Error(`Fail to detect job status.`);
        }
    } catch (err) {
        return new Error(`Fail to decode job's results: ${error(err)}`);
    }
}

const DESTROY_TIMEOUT = 5000;

export class Base {
    protected readonly logger: Logger = scope.getLogger(`Jobs`);
    protected readonly native: JobsNative;
    protected readonly queue: Queue = new Queue();

    private _state: State = State.created;

    constructor() {
        this.native = new (getNativeModule().UnboundJobs)() as JobsNative;
        this.logger.debug(`Rust Jobs native session is created`);
    }

    public async init(): Promise<Base> {
        return new Promise((resolve, reject) => {
            this.native
                .init()
                .then(() => {
                    this.logger.debug(`Rust Jobs native session is inited`);
                    this._state = State.inited;
                    resolve(this);
                })
                .catch((err: Error) => {
                    this.logger.error(
                        `Fail to init Jobs session: ${err instanceof Error ? err.message : err}`,
                    );
                    reject(err);
                });
        });
    }

    public async destroy(): Promise<void> {
        if (this._state !== State.inited) {
            return Promise.reject(new Error(`Session isn't inited`));
        }
        this._state = State.destroying;
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(
                    new Error(
                        this.logger.error(
                            `Timeout error. Session wasn't closed in ${
                                DESTROY_TIMEOUT / 1000
                            } sec.`,
                        ),
                    ),
                );
            }, DESTROY_TIMEOUT);
            this.native
                .destroy()
                .then(() => {
                    this.logger.debug(`Session has been destroyed`);
                    resolve();
                })
                .catch((err: Error) => {
                    this.logger.error(
                        `Fail to close session due error: ${
                            err instanceof Error ? err.message : err
                        }`,
                    );
                    reject(err);
                })
                .finally(() => {
                    this._state = State.destroyed;
                    clearTimeout(timeout);
                });
        });
    }

    protected async abort(sequence: number): Promise<void> {
        return new Promise((resolve, reject) => {
            this.native
                .abort(sequence)
                .then(resolve)
                .catch((err: Error) => {
                    this.logger.error(
                        `Fail to abort operation due error: ${
                            err instanceof Error ? err.message : err
                        }`,
                    );
                    reject(err);
                });
        });
    }

    protected sequence(): number {
        return this.queue.sequence();
    }

    protected execute<Output>(
        convert: ConvertCallback<Output>,
        task: Promise<Uint8Array>,
        sequence: number,
        alias: string,
    ): CancelablePromise<Output> {
        return new CancelablePromise((resolve, reject, cancel, refCancel, self) => {
            if (this._state !== State.inited) {
                return reject(new Error(`Session isn't inited`));
            }
            this.queue.add(sequence, alias);
            refCancel(() => {
                this.abort(sequence).catch((err: Error) => {
                    if (self.isCompleted()) {
                        this.logger.warn('Job was already completed on aborting');
                        return;
                    }
                    this.logger.error(`Fail to cancel ${error(err)}`);
                });
            });
            task.then((buf: Uint8Array) => {
                const decoded = convert(buf);
                if (decoded instanceof Cancelled || self.isCanceling()) {
                    cancel();
                } else if (decoded instanceof Error) {
                    reject(decoded);
                } else {
                    resolve(decoded);
                }
            })
                .catch((err: Error | Uint8Array) => {
                    const nerr = NativeError.from(err);
                    this.logger.error(`Fail to do "${alias}" operation due error: ${error(nerr)}`);
                    reject(nerr);
                })
                .finally(() => {
                    this.queue.remove(sequence);
                });
        });
    }
}
