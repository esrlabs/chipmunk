import { ErrorState } from '@elements/autocomplete/error';
import { Subject } from '@platform/env/subscription';

export class CmdErrorState extends ErrorState {
    protected updated: Subject<void> = new Subject();
    protected error: string | undefined;

    public validate(): void {
        const matches = this.value.match(/"/gi);
        if (matches === null || matches.length === 0) {
            this.error = undefined;
        } else if (matches.length % 2 !== 0) {
            this.error = `Not closed string: no closing "`;
        } else {
            this.error = undefined;
        }
    }

    public is(): boolean {
        return this.error !== undefined;
    }

    public msg(): string {
        return this.error === undefined ? '' : this.error;
    }

    public observer(): Subject<void> {
        return this.updated;
    }
}
