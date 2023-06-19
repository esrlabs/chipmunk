import { Subscriber } from 'platform/env/subscription';
import { Session } from 'rustcore';
import { JobsTracker } from 'platform/env/promise';
import { scope } from 'platform/env/scope';
import { Logger } from 'platform/log';
import { $ } from 'rustcore';
import { jobs } from '@service/jobs';
import { ICancelablePromise } from 'platform/env/promise';

import * as Events from 'platform/ipc/event';

export enum Jobs {
    search = 'search',
    values = 'values',
}

export class Holder {
    public readonly session: Session;
    public readonly subscriber: Subscriber;
    private readonly _jobs: Map<string, JobsTracker> = new Map();
    private readonly _observers: Map<string, { source: $.Observe; observer: ICancelablePromise }> =
        new Map();
    private readonly _logger: Logger;
    protected _shutdown = false;

    constructor(session: Session, subscriber: Subscriber) {
        this.session = session;
        this.subscriber = subscriber;
        this._logger = scope.getLogger(`[Session: ${this.session.getUUID()}]`);
    }

    public register<T, C, EN, EH>(family: Jobs): JobsTracker<T, C, EN, EH> {
        let jobs = this._jobs.get(family);
        if (jobs === undefined) {
            jobs = new JobsTracker();
            this._jobs.set(family, jobs);
        }
        return jobs as unknown as JobsTracker<T, C, EN, EH>;
    }

    public destroy(): Promise<void> {
        this._shutdown = true;
        return new Promise((resolve, reject) => {
            Promise.allSettled(
                Array.from(this._jobs.values()).map((jobs) =>
                    jobs.abort().catch((err: Error) => {
                        this._logger.error(
                            `Fail correctly stop session's jobs; error: ${err.message}`,
                        );
                    }),
                ),
            )
                .catch((err: Error) => {
                    this._logger.error(
                        `Fail correctly stop all session's jobs; error: ${err.message}`,
                    );
                })
                .finally(() => {
                    this._observers.clear();
                    this.session.destroy().then(resolve).catch(reject);
                });
        });
    }

    public observe(): {
        start(source: $.Observe): Promise<string>;
        cancel(uuid: string): Promise<void>;
        list(): { [key: string]: string };
    } {
        return {
            start: (source: $.Observe): Promise<string> => {
                if (this._shutdown) {
                    return Promise.reject(new Error(`Session is closing`));
                }
                let jobDesc = source.origin.asJob();
                if (jobDesc instanceof Error) {
                    this._logger.error(`Fail to get job description: ${jobDesc.message}`);
                    jobDesc = {
                        name: 'unknown',
                        desc: 'unknown',
                        icon: undefined,
                    };
                }
                const observe = jobs
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
                        .observe(source.configuration)
                        .on('confirmed', () => {
                            Events.IpcEvent.emit(
                                new Events.Observe.Started.Event({
                                    session: this.session.getUUID(),
                                    operation: observer.uuid(),
                                    source: source.json().to(),
                                }),
                            );
                        })
                        .on('processing', () => {
                            resolve(observer.uuid());
                        })
                        .catch((err: Error) => {
                            this._logger.error(`Fail to call observe. Error: ${err.message}`);
                            reject(err);
                        })
                        .finally(() => {
                            observe.done();
                            this._observers.delete(observer.uuid());
                            Events.IpcEvent.emit(
                                new Events.Observe.Finished.Event({
                                    session: this.session.getUUID(),
                                    operation: observer.uuid(),
                                    source: source.json().to(),
                                }),
                            );
                        });
                    this._observers.set(observer.uuid(), { source, observer });
                });
            },
            cancel: (uuid: string): Promise<void> => {
                const operation = this._observers.get(uuid);
                if (operation === undefined) {
                    return Promise.reject(new Error(`Operation isn't found`));
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
                this._observers.forEach((operation, uuid) => {
                    list[uuid] = operation.source.json().to();
                });
                return list;
            },
        };
    }

    public isShutdowning(): boolean {
        return this._shutdown;
    }
}
