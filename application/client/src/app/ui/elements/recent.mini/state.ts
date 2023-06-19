import { Action } from '@service/recent/action';
import { WrappedAction } from '../recent/action';
import { Filter } from '@elements/filter/filter';
import { recent } from '@service/recent';
import { Subject } from '@platform/env/subscription';
import { IlcInterface } from '@service/ilc';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { Holder } from '@module/matcher/holder';
import { Logger } from '@platform/log';

import * as $ from '@platform/types/observe';

export type CloseHandler = () => void;

export class State extends Holder {
    public filter: Filter;
    public actions: WrappedAction[] = [];
    public update: Subject<void> = new Subject<void>();
    public selected: string = '';
    public readonly observe?: $.Observe;

    protected close: CloseHandler | undefined;

    private _logger: Logger;

    constructor(
        ilc: IlcInterface & ChangesDetector,
        observe?: $.Observe,
    ) {
        super();
        this.observe = observe;
        this.filter = new Filter(ilc, { placeholder: 'Recent files / sources' });
        this.filter.subjects.get().change.subscribe((value: string) => {
            this.filtering(value);
            ilc.detectChanges();
        });
        this._logger = ilc.log();
        ilc.env().subscriber.register(
            ilc
                .ilc()
                .services.ui.listener.listen<KeyboardEvent>(
                    'keyup',
                    window,
                    (event: KeyboardEvent) => {
                        if (event.key === 'ArrowDown') {
                            this.move().down();
                        } else if (event.key === 'ArrowUp') {
                            this.move().up();
                        } else if (event.key === 'Enter') {
                            const action = this.actions.find((a) => a.hash() === this.selected);
                            if (action === undefined) {
                                return true;
                            }
                            action.action.apply();
                            this.close !== undefined && this.close();
                            return true;
                        }
                        ilc.detectChanges();
                        return true;
                    },
                ),
        );
        this.reload().then(() => {
            this.actions.length > 0 && (this.selected = this.actions[0].hash());
        });
    }

    public bind(close: CloseHandler) {
        this.close = close;
    }

    public filtering(value: string) {
        this.matcher.search(value);
        if (value.trim() === '') {
            this.actions.sort((a: WrappedAction, b: WrappedAction) => {
                return b.action.stat.score().recent() >= a.action.stat.score().recent() ? 1 : -1;
            });
        } else {
            this.actions.sort((a: WrappedAction, b: WrappedAction) => b.getScore() - a.getScore());
        }
        this.move().update();
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
                this._logger.error(`Fail to remove recent action: ${err.message}`);
            });
    }

    public removeAll() {
        recent
            .get()
            .then((actions: Action[]) => {
                this.remove(actions.map((action: Action) => action.uuid));
            })
            .catch((err: Error) => {
                this._logger.error(`Fail to remove all recent actions: ${err.message}`);
            });
    }

    protected move(): {
        up(): void;
        down(): void;
        update(): void;
    } {
        const actions = this.getFilteredActions();
        return {
            up: (): void => {
                if (actions.length === 0) {
                    return;
                }
                if (this.selected === '') {
                    this.selected = actions[actions.length - 1].hash();
                    return;
                }
                const index = actions.findIndex((a) => a.hash() === this.selected);
                if (index === -1 || index === 0) {
                    this.selected = actions[actions.length - 1].hash();
                    return;
                }
                this.selected = actions[index - 1].hash();
            },
            down: (): void => {
                if (actions.length === 0) {
                    return;
                }
                if (this.selected === '') {
                    this.selected = actions[0].hash();
                    return;
                }
                const index = actions.findIndex((a) => a.hash() === this.selected);
                if (index === -1 || index === actions.length - 1) {
                    this.selected = actions[0].hash();
                    return;
                }
                this.selected = actions[index + 1].hash();
            },
            update: (): void => {
                if (actions.length === 0) {
                    return;
                }
                if (this.selected === '') {
                    this.selected = actions[0].hash();
                    return;
                }
                const index = actions.findIndex((a) => a.hash() === this.selected);
                if (index === -1) {
                    this.selected = actions[0].hash();
                }
            },
        };
    }

    protected reload(): Promise<void> {
        return recent
            .get()
            .then((actions: Action[]) => {
                this.actions = actions
                    .filter((action) => action.isSuitable(this.observe))
                    .map((action) => new WrappedAction(action, this.matcher));
                this.actions.sort((a: WrappedAction, b: WrappedAction) => {
                    return b.action.stat.score().recent() >= a.action.stat.score().recent()
                        ? 1
                        : -1;
                });
                this.update.emit();
            })
            .catch((error: Error) => {
                this._logger.error(`Fail to get recent due error: ${error.message}`);
            });
    }
}
