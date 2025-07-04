import { Subscriber } from 'platform/env/subscription';
import { Session } from 'rustcore';
import { JobsTracker } from 'platform/env/promise';
import { scope } from 'platform/env/scope';
import { Logger } from 'platform/log';
import { jobs } from '@service/jobs';
import { ICancelablePromise } from 'platform/env/promise';
import { SessionSetup } from 'platform/types/bindings';

import * as Events from 'platform/ipc/event';
import { IJob } from '@service/jobs/job';

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
        start(setup: SessionSetup): Promise<string>;
        cancel(uuid: string): Promise<void>;
        list(): string[];
    } {
        return {
            start: (setup: SessionSetup): Promise<string> => {
                if (this.shutdown) {
                    return Promise.reject(new Error(`Session is closing`));
                }
                const description = this.getDescription(setup);
                const job = jobs
                    .create({
                        session: this.session.getUUID(),
                        name: description.title,
                        desc: description.desctiption,
                        // TODO: probably we should refuse from icons
                        icon: '',
                    })
                    .start();
                return new Promise((resolve, reject) => {
                    const observer = this.session
                        .getStream()
                        .observe(setup)
                        .on('confirmed', () => {
                            Events.IpcEvent.emit(
                                new Events.Observe.Started.Event({
                                    session: this.session.getUUID(),
                                    operation: observer.uuid(),
                                    options: setup,
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
                                    options: setup,
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

    protected getDescription(setup: SessionSetup): {
        title: string;
        desctiption: string | undefined;
    } {
        if (setup.origin === 'Source') {
            // TODO: Check idents
            return {
                title: 'Custom Source',
                desctiption: `Data comes from selected source provider`,
            };
        } else if ((setup.origin as { File: string }).File) {
            return { title: `Selected File`, desctiption: (setup.origin as { File: string }).File };
        } else if ((setup.origin as { Files: string[] }).Files) {
            return {
                title: `Collection of Files`,
                desctiption: `${(setup.origin as { Files: string[] }).Files.length} files`,
            };
        } else {
            return { title: 'Unknown', desctiption: undefined };
        }
    }
}
