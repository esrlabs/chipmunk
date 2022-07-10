import { Action } from '@service/recent/action';
import { WrappedAction } from '../recent/action';
import { Filter } from '@elements/filter/filter';
import { recent } from '@service/recent';
import { Subject } from '@platform/env/subscription';
import { IlcInterface } from '@service/ilc';
import { ChangesDetector } from '@ui/env/extentions/changes';

export type CloseHandler = () => void;

export class State {
    public filter: Filter;
    public actions: WrappedAction[] = [];
    public update: Subject<void> = new Subject<void>();
    public selected: string = '';
    protected close: CloseHandler | undefined;

    constructor(ilc: IlcInterface & ChangesDetector) {
        this.filter = new Filter(ilc);
        this.filter.subjects.get().change.subscribe((value: string) => {
            this.filtering(value);
            ilc.detectChanges();
        });
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
        recent
            .get()
            .then((actions: Action[]) => {
                this.actions = actions.map((action) => new WrappedAction(action));
                this.actions.length > 0 && (this.selected = this.actions[0].hash());
                this.update.emit();
            })
            .catch((error: Error) => {
                console.log(`Fail to get recent due error: ${error.message}`);
            });
    }

    public bind(close: CloseHandler) {
        this.close = close;
    }

    public filtering(value: string) {
        this.actions.forEach((action) => {
            action.filter(value);
        });
        this.move().update();
        this.update.emit();
    }

    public getFilteredActions(): WrappedAction[] {
        return this.actions.filter((a) => a.filtered);
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
}
