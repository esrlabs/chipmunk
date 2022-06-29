import { Session } from '@service/session';
import { Subject, Subscriber } from '@platform/env/subscription';

export class Progress {
    public working: boolean = false;
    public found: number = 0;
    public hidden: boolean = true;
    public readonly updated: Subject<void> = new Subject();

    private _session: Session;
    private _subscriber: Subscriber = new Subscriber();

    constructor(session: Session) {
        this._session = session;
        this._subscriber.register(
            this._session.search.subjects.get().updated.subscribe((len: number) => {
                this.found = len;
                this.updated.emit();
            }),
        );
    }

    public destroy() {
        this.updated.destroy();
        this._subscriber.unsubscribe();
    }

    public start() {
        this.hidden = false;
        this.working = true;
    }

    public stop() {
        this.working = false;
    }

    public hide() {
        this.hidden = true;
    }

    public visible(): boolean {
        const total = this._session.stream.len();
        return total > 0 && !this.hidden;
    }

    public summary(): string {
        const total = this._session.stream.len();
        return `${this.found} in ${total} (${((this.found / total) * 100).toFixed(2)}%)`;
    }

    public setFound(found: number) {
        this.found = found;
    }
}
