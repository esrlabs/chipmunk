import { Subscriber } from 'platform/env/subscription';
import { Session } from 'rustcore';
import { JobsTracker } from 'platform/env/promise';
import { scope } from 'platform/env/scope';
import { Logger } from 'platform/log';
import { jobs } from '@service/jobs';
import { ICancelablePromise } from 'platform/env/promise';
import { $ } from 'rustcore';

import * as Events from 'platform/ipc/event';
import * as path from 'path';

export enum Jobs {
    search = 'search',
    values = 'values',
}

export class Holder {
    public readonly session: Session;
    public readonly subscriber: Subscriber;
    protected readonly jobs: Map<string, JobsTracker> = new Map();
    protected readonly observing: {
        active: Map<string, { source: $.Observe; observer: ICancelablePromise }>;
        finished: Map<string, $.Observe>;
    } = {
        active: new Map(),
        finished: new Map(),
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
        start(observe: $.IObserve): Promise<string>;
        cancel(uuid: string): Promise<void>;
        list(): { [key: string]: string };
    } {
        return {
            start: (cfg: $.IObserve): Promise<string> => {
                const observe = new $.Observe(cfg);
                if (this.shutdown) {
                    return Promise.reject(new Error(`Session is closing`));
                }
                let jobDesc = observe.origin.asJob();
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
                        .observe(observe.configuration)
                        .on('confirmed', () => {
                            Events.IpcEvent.emit(
                                new Events.Observe.Started.Event({
                                    session: this.session.getUUID(),
                                    operation: observer.uuid(),
                                    source: observe.json().to(),
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
                            this.observing.finished.set(observer.uuid(), observe);
                            Events.IpcEvent.emit(
                                new Events.Observe.Finished.Event({
                                    session: this.session.getUUID(),
                                    operation: observer.uuid(),
                                    source: observe.json().to(),
                                }),
                            );
                        });
                    this.observing.active.set(observer.uuid(), { source: observe, observer });
                });
            },
            cancel: (uuid: string): Promise<void> => {
                const operation = this.observing.active.get(uuid);
                if (operation === undefined) {
                    return Promise.reject(new Error(`AAA Operation isn't found`));
                }
                return new Promise((resolve) => {
                    operation.observer
                        .finally(() => {
                            resolve();
                        })
                        .abort();
                });
            },
            list: (): { [key: string]: string } => {
                const list: { [key: string]: string } = {};
                this.observing.active.forEach((operation, uuid) => {
                    list[uuid] = operation.source.json().to();
                });
                return list;
            },
        };
    }

    public getFileExt(): string | Error {
        const all = [
            Array.from(this.observing.active.values()).map((o) => o.source),
            Array.from(this.observing.finished.values()),
        ].flat();
        const files: Array<string | undefined> = all
            .map((o) => o.origin.files())
            .filter((f) => f !== undefined)
            .flat();
        if (files.filter((f) => f === undefined).length > 0) {
            return new Error(`Streams arn't supported yet`);
        }
        const parsers: $.Parser.Protocol[] = [];
        all.forEach((observe) => {
            if (parsers.includes(observe.parser.alias())) {
                return;
            }
            parsers.push(observe.parser.alias());
        });
        if (parsers.length > 1) {
            return new Error(`Multiple parsers are used`);
        } else if (parsers.length === 0) {
            return new Error(`No parsers has been found`);
        }
        const exts: string[] = files
            .map((f) => path.extname(f as string))
            .filter((ex) => ex.trim() !== '');
        switch (parsers[0]) {
            case $.Parser.Protocol.Text:
                return `.txt`;
            //TODO AAZ: Plugin added here temporally to make it compile
            case $.Parser.Protocol.Plugin:
            case $.Parser.Protocol.Dlt:
            case $.Parser.Protocol.SomeIp:
                if (files.length === 0) {
                    return new Error(
                        `No assigned files are found. Exporting from stream into new session arn't supported`,
                    );
                }
                return exts.length === 0 ? '' : exts[0];
        }
    }

    public isShutdowning(): boolean {
        return this.shutdown;
    }
}
