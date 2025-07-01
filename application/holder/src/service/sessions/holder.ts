import { Subscriber } from 'platform/env/subscription';
import { Session } from 'rustcore';
import { JobsTracker } from 'platform/env/promise';
import { scope } from 'platform/env/scope';
import { Logger } from 'platform/log';
import { jobs } from '@service/jobs';
import { ICancelablePromise } from 'platform/env/promise';
import { Tys } from 'rustcore';

import * as Events from 'platform/ipc/event';

export enum Jobs {
    search = 'search',
    values = 'values',
}

export class Holder {
    public readonly session: Session;
    public readonly subscriber: Subscriber;
    protected readonly jobs: Map<string, JobsTracker> = new Map();
    protected readonly observing: {
        active: Map<string, ICancelablePromise>;
        finished: Set<string>;
    } = {
        active: new Map(),
        finished: new Set(),
    };
    protected readonly logger: Logger;
    protected shutdown = false;

    constructor(session: Session, subscriber: Subscriber) {
        this.session = session;
        this.subscriber = subscriber;
        this.logger = scope.getLogger(`[Session: ${this.session.getUUID()}]`);
    }

    public register<T, C, EN, EH>(family: Jobs): JobsTracker<T, C, EN, EH> {
        let jobs = this.jobs.get(family);
        if (jobs === undefined) {
            jobs = new JobsTracker();
            this.jobs.set(family, jobs);
        }
        return jobs as unknown as JobsTracker<T, C, EN, EH>;
    }

    public destroy(): Promise<void> {
        this.shutdown = true;
        return new Promise((resolve, reject) => {
            Promise.allSettled(
                Array.from(this.jobs.values()).map((jobs) =>
                    jobs.abort().catch((err: Error) => {
                        this.logger.error(
                            `Fail correctly stop session's jobs; error: ${err.message}`,
                        );
                    }),
                ),
            )
                .catch((err: Error) => {
                    this.logger.error(
                        `Fail correctly stop all session's jobs; error: ${err.message}`,
                    );
                })
                .finally(() => {
                    this.observing.active.clear();
                    this.session.destroy().then(resolve).catch(reject);
                });
        });
    }

    public observe(): {
        start(options: Tys.bindings.SessionSetup): Promise<string>;
        cancel(uuid: string): Promise<void>;
        list(): string[];
    } {
        return {
            start: (options: Tys.bindings.SessionSetup): Promise<string> => {
                const holder = new Tys.sessionsetup.SessionSetupHolder(options);
                if (this.shutdown) {
                    return Promise.reject(new Error(`Session is closing`));
                }
                let jobDesc = holder.asJob();
                if (jobDesc instanceof Error) {
                    this.logger.error(`Fail to get job description: ${jobDesc.message}`);
                    jobDesc = {
                        name: 'unknown',
                        desc: 'unknown',
                        icon: undefined,
                    };
                }
                const job = jobs
                    .create({
                        session: this.session.getUUID(),
                        name: jobDesc.name,
                        desc: jobDesc.desc,
                        icon: jobDesc.icon,
                    })
                    .start();
                return new Promise((resolve, reject) => {
                    const observer = this.session
                        .getStream()
                        .observe(options)
                        .on('confirmed', () => {
                            Events.IpcEvent.emit(
                                new Events.Observe.Started.Event({
                                    session: this.session.getUUID(),
                                    operation: observer.uuid(),
                                    options,
                                }),
                            );
                        })
                        .on('processing', () => {
                            resolve(observer.uuid());
                        })
                        .catch((err: Error) => {
                            this.logger.error(`Fail to call observe. Error: ${err.message}`);
                            reject(err);
                        })
                        .finally(() => {
                            job.done();
                            this.observing.active.delete(observer.uuid());
                            this.observing.finished.add(observer.uuid());
                            Events.IpcEvent.emit(
                                new Events.Observe.Finished.Event({
                                    session: this.session.getUUID(),
                                    operation: observer.uuid(),
                                    options,
                                }),
                            );
                        });
                    this.observing.active.set(observer.uuid(), observer);
                });
            },
            cancel: (uuid: string): Promise<void> => {
                const observer = this.observing.active.get(uuid);
                if (observer === undefined) {
                    return Promise.reject(new Error(`Operation isn't found`));
                }
                return new Promise((resolve) => {
                    observer
                        .finally(() => {
                            resolve();
                        })
                        .abort();
                });
            },
            list: (): string[] => {
                return Array.from(this.observing.active.keys());
            },
        };
    }

    public getFileExt(): string | Error {
        return new Error(`Not implemented`);
        // const all = [
        //     Array.from(this.observing.active.values()).map((o) => o.source),
        //     Array.from(this.observing.finished.values()),
        // ].flat();
        // const files: Array<string | undefined> = all
        //     .map((o) => o.origin.files())
        //     .filter((f) => f !== undefined)
        //     .flat();
        // if (files.filter((f) => f === undefined).length > 0) {
        //     return new Error(`Streams arn't supported yet`);
        // }
        // const parsers: $.Parser.Protocol[] = [];
        // all.forEach((observe) => {
        //     if (parsers.includes(observe.parser.alias())) {
        //         return;
        //     }
        //     parsers.push(observe.parser.alias());
        // });
        // if (parsers.length > 1) {
        //     return new Error(`Multiple parsers are used`);
        // } else if (parsers.length === 0) {
        //     return new Error(`No parsers has been found`);
        // }
        // const exts: string[] = files
        //     .map((f) => path.extname(f as string))
        //     .filter((ex) => ex.trim() !== '');
        // switch (parsers[0]) {
        //     case $.Parser.Protocol.Text:
        //         return `.txt`;
        //     case $.Parser.Protocol.Plugin:
        //         return exts.length === 0 ? '.plg' : exts[0];
        //     case $.Parser.Protocol.Dlt:
        //     case $.Parser.Protocol.SomeIp:
        //         if (files.length === 0) {
        //             return new Error(
        //                 `No assigned files are found. Exporting from stream into new session arn't supported`,
        //             );
        //         }
        //         return exts.length === 0 ? '' : exts[0];
        // }
    }

    public isShutdowning(): boolean {
        return this.shutdown;
    }
}
