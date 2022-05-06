import { Session } from '@service/session';
import { Channel } from '@env/decorators/component';
import { Subject } from '@platform/env/subscription';

export class Progress {
    public working: boolean = false;
    public found: number = 0;
    public hidden: boolean = true;
    public readonly updated: Subject<void> = new Subject();
    private _session: Session;

    constructor(session: Session, channel: Channel) {
        this._session = session;
        channel.session.search.updated((event) => {
            if (this._session.uuid() !== event.session) {
                return;
            }
            this.found = event.len;
            this.updated.emit();
        });
    }

    public destroy() {
        this.updated.destroy();
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
