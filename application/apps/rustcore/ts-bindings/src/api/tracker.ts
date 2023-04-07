import { Logger } from 'platform/log';
import { scope } from 'platform/env/scope';
import { getNativeModule } from '../native/native';
import { TrackerNative } from '../native/native.tracker';
import { EventProvider } from './tracker.provider';
import { unique } from 'platform/env/sequence';

enum State {
    destroyed,
    destroying,
    inited,
    created,
}

export class Tracker {
    public static async create(): Promise<Tracker> {
        const instance = new Tracker();
        await instance.init();
        return instance;
    }

    protected readonly logger: Logger = scope.getLogger(`Tracker`);
    protected readonly native: TrackerNative;
    protected readonly uuid = unique();

    public readonly provider: EventProvider;

    private _state: State = State.created;

    constructor() {
        this.native = new (getNativeModule().RustProgressTracker)() as TrackerNative;
        this.provider = new EventProvider(this.uuid);
        this.logger.debug(`Rust Tracker native session is created`);
    }

    public async init(): Promise<Tracker> {
        return new Promise((resolve, reject) => {
            this.native
                .init(this.provider.getEmitter())
                .then(() => {
                    this.logger.debug(`Rust Tracker native session is inited`);
                    this._state = State.inited;
                    resolve(this);
                })
                .catch((err: Error) => {
                    this.logger.error(
                        `Fail to init Tracker session: ${err instanceof Error ? err.message : err}`,
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
                this.logger.error(`Timeout error. Session wasn't closed in 5 sec.`);
                reject(new Error(`Timeout error. Session wasn't closed in 5 sec.`));
            }, 5000);
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
}
