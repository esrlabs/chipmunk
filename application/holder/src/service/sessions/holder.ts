import { Subscriber } from 'platform/env/subscription';
import { Session } from 'rustcore';
import { JobsTracker } from 'platform/env/promise';
import { scope } from 'platform/env/scope';
import { Instance as Logger } from 'platform/env/logger';

export enum Jobs {
    search = 'search',
}

export class Holder {
    public readonly session: Session;
    public readonly subscriber: Subscriber;
    private readonly _jobs: Map<string, JobsTracker> = new Map();
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
                    this.session.destroy().then(resolve).catch(reject);
                });
        });
    }

    public isShutdowning(): boolean {
        return this._shutdown;
    }
}
