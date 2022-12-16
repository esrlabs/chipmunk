import { Session } from '@service/session';
import { Subject, Subscriber } from '@platform/env/subscription';

export class Progress {
    public working: boolean = false;
    public readonly updated: Subject<void> = new Subject();

    private _session: Session;
    private _subscriber: Subscriber = new Subscriber();

    constructor(session: Session, working: boolean) {
        this._session = session;
        this.working = working;
        this._subscriber.register(
            this._session.search.subjects.get().updated.subscribe((_event) => {
                this.updated.emit();
            }),
        );
    }

    public destroy() {
        this.updated.destroy();
        this._subscriber.unsubscribe();
    }

    public start() {
        this.working = true;
    }

    public stop() {
        this.working = false;
    }

    public visible(): boolean {
        if (this._session.stream.len() === 0) {
            return false;
        }
        if (
            this._session.search.store().filters().getActiveCount() > 0 ||
            this._session.search.state().hasActiveSearch()
        ) {
            return true;
        }
        return false;
    }

    public summary(): string {
        const total = this._session.stream.len();
        const found = this._session.search.len();
        return `${found} in ${total} (${((found / total) * 100).toFixed(2)}%)`;
    }
}
