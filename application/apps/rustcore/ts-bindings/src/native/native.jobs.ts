import { Logger } from 'platform/log';
import { scope } from 'platform/env/scope';
import { CancelablePromise } from 'platform/env/promise';
import { error } from 'platform/log/utils';
import { getNativeModule } from '../native/native';
import { Type, Source, NativeError } from '../interfaces/errors';

import * as proto from 'protocol';
import * as ty from '../protocol';

export abstract class JobsNative {
    public abstract abort(sequence: number): Promise<void>;

    public abstract init(): Promise<void>;

    public abstract destroy(): Promise<void>;

    public abstract isFileBinary(sequence: number, filePath: string): Promise<boolean>;

    public abstract jobCancelTest(sequence: number, num_a: number, num_b: number): Promise<string>;

    public abstract listFolderContent(
        sequence: number,
        depth: number,
        max: number,
        paths: string[],
        includeFiles: boolean,
        includeFolders: boolean,
    ): Promise<string>;

    public abstract spawnProcess(sequence: number, path: string, args: string[]): Promise<void>;
    public abstract getFileChecksum(sequence: number, path: string): Promise<string>;
    public abstract getDltStats(sequence: number, files: string[]): Promise<string>;
    public abstract getSomeipStatistic(sequence: number, files: string[]): Promise<string>;
    public abstract getShellProfiles(sequence: number): Promise<string>;
    public abstract getContextEnvvars(sequence: number): Promise<string>;
    public abstract getSerialPortsList(sequence: number): Promise<string[]>;
    public abstract sleep(sequence: number, ms: number): Promise<undefined>;
    public abstract getRegexError(
        sequence: number,
        filter: {
            value: string;
            is_regex: boolean;
            ignore_case: boolean;
            is_word: boolean;
        },
    ): Promise<string | undefined | null>;
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

export type ConvertCallback<Input, Output> = (input: Input) => Output | Error;

enum State {
    destroyed,
    destroying,
    inited,
    created,
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
                    const native = NativeError.from(err);
                    this.logger.error(
                        `Fail to init Jobs session: ${
                            native instanceof Error ? native.message : native
                        }`,
                    );
                    reject(native);
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
                    const native = NativeError.from(err);
                    this.logger.error(
                        `Fail to close session due error: ${
                            native instanceof Error ? native.message : native
                        }`,
                    );
                    reject(native);
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
                    const native = NativeError.from(err);
                    this.logger.error(
                        `Fail to abort operation due error: ${
                            native instanceof Error ? native.message : native
                        }`,
                    );
                    reject(native);
                });
        });
    }

    protected sequence(): number {
        return this.queue.sequence();
    }

    protected execute<Input, Output>(
        convert: undefined | ConvertCallback<Input, Output>,
        task: Promise<any>,
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
            task.then((buf: number[]) => {
                try {
                    const output: ty.CommandOutcome = proto.CommandOutcome.decode(
                        Uint8Array.from(buf),
                    );
                    if (!output.outcome_oneof) {
                        return reject(new Error(`Invalid output from command`));
                    }
                    const result = output.outcome_oneof;
                    if ('Cancelled' in result || self.isCanceling()) {
                        if (!('Cancelled' in result) && self.isCanceling()) {
                            this.logger.warn('Job result dropped due canceling');
                        }
                        cancel();
                    } else if ('Finished' in result) {
                        const value = (() => {
                            const value:
                                | {
                                      output_oneof: ty.OutputOneof | null | undefined;
                                  }
                                | null
                                | undefined = result.Finished?.result;
                            if (!value || !value.output_oneof) {
                                return undefined;
                            }
                            const output = value.output_oneof;
                            if ('StringValue' in output) {
                                return output.StringValue;
                            } else if ('StringVecValue' in output) {
                                return output.StringVecValue?.values;
                            } else if ('OptionStringValue' in output) {
                                return output.OptionStringValue === ''
                                    ? undefined
                                    : output.OptionStringValue;
                            } else if ('BoolValue' in output) {
                                return output.BoolValue;
                            } else if ('Int64Value' in output) {
                                return Number(output.Int64Value);
                            } else if ('EmptyValue' in output) {
                                return undefined;
                            } else {
                                this.logger.error(
                                    `Not supported value of job output: ${JSON.stringify(output)}`,
                                );
                                return undefined;
                            }
                        })();
                        if (convert === undefined) {
                            resolve(value as unknown as Output);
                        } else {
                            const converted: Output | Error = convert(value as unknown as Input);
                            if (converted instanceof Error) {
                                reject(converted);
                            } else {
                                resolve(converted);
                            }
                        }
                    } else {
                        return reject(
                            new Error(`Invalid output from command: no Finished/Cancelled state`),
                        );
                    }
                } catch (e) {
                    reject(
                        new NativeError(
                            new Error(
                                `Fail to parse results (${JSON.stringify(buf)}): ${error(e)}`,
                            ),
                            Type.Other,
                            Source.Other,
                        ),
                    );
                }
            })
                .catch((err: Error) => {
                    const native = NativeError.from(err);
                    this.logger.error(
                        `Fail to do "${alias}" operation due error: ${error(native)}`,
                    );
                    reject(native);
                })
                .finally(() => {
                    this.queue.remove(sequence);
                });
        });
    }
}
