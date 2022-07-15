import { Action } from '@service/recent/action';
import { WrappedAction } from './action';
import { Filter } from '@ui/env/entities/filter';
import { recent } from '@service/recent';
import { Subject } from '@platform/env/subscription';
import { IlcInterface } from '@service/ilc';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { syncHasFocusedInput } from '@ui/env/globals';
import { Holder } from '@module/matcher';

export class State extends Holder {
    public filter: Filter;
    public actions: WrappedAction[] = [];
    public update: Subject<void> = new Subject<void>();

    constructor(ilc: IlcInterface & ChangesDetector) {
        super();
        this.filter = new Filter(ilc.ilc());
        ilc.env().subscriber.register(
            this.filter.subjects.get().drop.subscribe(this.filtering.bind(this)),
        );
        ilc.env().subscriber.register(
            ilc
                .ilc()
                .services.ui.listener.listen<KeyboardEvent>(
                    'keyup',
                    window,
                    (event: KeyboardEvent) => {
                        if (!syncHasFocusedInput()) {
                            return true;
                        }
                        if (this.filter.keyboard(event)) {
                            this.filtering();
                            ilc.detectChanges();
                        }
                        return true;
                    },
                ),
        );
        recent
            .get()
            .then((actions: Action[]) => {
                this.actions = actions.map((action) => new WrappedAction(action, this.matcher));
                this.update.emit();
            })
            .catch((error: Error) => {
                console.log(`Fail to get recent due error: ${error.message}`);
            });
    }

    public filtering() {
        this.matcher.search(this.filter.value());
        this.actions.sort((a: WrappedAction, b: WrappedAction) => b.getScore() - a.getScore());
        this.update.emit();
    }

    public getFilteredActions(): WrappedAction[] {
        return this.actions.filter((a: WrappedAction) => a.getScore() > 0);
    }
}
