import { Subject } from '@platform/env/subscription';
import { ErrorState } from '@elements/autocomplete/error';

export class PathErrorState extends ErrorState {
    protected updated: Subject<void> = new Subject();
    protected error: string | undefined;

    public validate(): void {
        if (this.value.trim().length === 0) {
            this.error = 'No path'
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
