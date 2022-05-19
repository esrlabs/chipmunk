import { Action } from '@service/recent/action';
import { WrappedAction } from './action';
import { Filter } from '@ui/env/entities/filter';
import { recent } from '@service/recent';
import { Subject } from '@platform/env/subscription';

export class State {
    public filter: Filter = new Filter();
    public actions: WrappedAction[] = [];
    public update: Subject<void> = new Subject<void>();

    constructor() {
        recent
            .get()
            .then((actions: Action[]) => {
                this.actions = actions.map((action) => new WrappedAction(action));
                this.update.emit();
            })
            .catch((error: Error) => {
                console.log(`Fail to get recent due error: ${error.message}`);
            });
    }

    public filtering() {
        this.actions.forEach((action) => {
            action.filter(this.filter.value());
        });
        this.update.emit();
    }

    public getFilteredActions(): WrappedAction[] {
        return this.actions.filter((a) => a.filtered);
    }
}
