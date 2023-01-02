import { Action } from '@service/recent/action';
import { WrappedAction } from './action';
import { Filter } from '@ui/env/entities/filter';
import { recent } from '@service/recent';
import { Subject, Subscription } from '@platform/env/subscription';
import { IlcInterface } from '@service/ilc';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { syncHasFocusedInput } from '@ui/env/globals';
import { Holder } from '@module/matcher';
import { ParserName, Origin } from '@platform/types/observe';

export class State extends Holder {
    public actions: WrappedAction[] = [];

    public readonly filter: Filter;
    public readonly update: Subject<void> = new Subject<void>();
    public readonly origin?: Origin;
    public readonly parser?: ParserName;

    constructor(
        ilc: IlcInterface & ChangesDetector,
        origin: Origin | undefined,
        parser: ParserName | undefined,
    ) {
        super();
        this.filter = new Filter(ilc.ilc());
        this.origin = origin;
        this.parser = parser;
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
        this.reload();
    }

    public filtering() {
        this.matcher.search(this.filter.value());
        if (this.filter.value().trim() === '') {
            this.actions.sort(
                (a: WrappedAction, b: WrappedAction) =>
                    b.action.stat.usageScore() - a.action.stat.usageScore(),
            );
        } else {
            this.actions.sort((a: WrappedAction, b: WrappedAction) => b.getScore() - a.getScore());
        }
        this.update.emit();
    }

    public getFilteredActions(): WrappedAction[] {
        return this.actions.filter((a: WrappedAction) => a.getScore() > 0);
    }

    public remove(uuids: string[]) {
        recent
            .delete(uuids)
            .then(() => {
                this.reload();
            })
            .catch((err: Error) => {
                console.error(`Fail to remove recent action: ${err.message}`);
            });
    }

    public removeAll() {
        recent
            .get()
            .then((actions: Action[]) => {
                this.remove(actions.map((action: Action) => action.uuid));
            })
            .catch((err: Error) => {
                console.error(`Fail to remove all recent actions: ${err.message}`);
            });
    }

    public entryUpdate(): Subscription {
        return recent.entryUpdate.subscribe(this.reload.bind(this));
    }

    protected reload(): void {
        recent
            .get()
            .then((actions: Action[]) => {
                this.actions = actions
                    .filter((action) => action.isSuitable(this.origin, this.parser))
                    .map((action) => new WrappedAction(action, this.matcher))
                    .sort(
                        (a: WrappedAction, b: WrappedAction) =>
                            b.action.stat.usageScore() - a.action.stat.usageScore(),
                    );
                this.update.emit();
            })
            .catch((error: Error) => {
                console.log(`Fail to get recent due error: ${error.message}`);
            });
    }
}
