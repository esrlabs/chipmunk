import { Provider as Base, INoContentActions, IStatistics } from './provider';
import { Action } from '@service/recent/action';
import { recent } from '@service/recent';
import { IMenuItem } from '@ui/service/contextmenu';

export class Provider extends Base<Action> {
    protected count: number = 0;

    protected storage(): {
        remove(uuids: string[]): void;
        removeAll(): void;
    } {
        return {
            remove: (uuids: string[]): void => {
                recent
                    .delete(uuids)
                    .then(() => {
                        this.reload.emit();
                    })
                    .catch((err: Error) => {
                        this.ilc.log().error(`Fail to remove recent action: ${err.message}`);
                    });
            },
            removeAll: (): void => {
                recent
                    .get()
                    .then((actions: Action[]) => {
                        this.storage().remove(actions.map((action: Action) => action.uuid));
                        this.reload.emit();
                    })
                    .catch((err: Error) => {
                        this.ilc.log().error(`Fail to remove all recent actions: ${err.message}`);
                    });
            },
        };
    }
    public load(): Promise<Action[]> {
        return recent.get().then((actions: Action[]) => {
            actions = actions.filter((action) => action.isSuitable(this.observe));
            actions.sort((a: Action, b: Action) => {
                return b.stat.score().recent() >= a.stat.score().recent() ? 1 : -1;
            });
            this.count = actions.length;
            return actions;
        });
    }

    public action(action: unknown): void {
        if (!(action instanceof Action)) {
            return;
        }
        action.apply().catch((err: Error) => {
            this.ilc.log().error(`Fail to apply action: ${err.message}`);
        });
    }

    public stat(): IStatistics {
        return {
            title: `Available ${this.count} recent actions`,
            total: this.count,
            info: [],
        };
    }

    public getContextMenu(entity: unknown, _close?: () => void): IMenuItem[] {
        if (!(entity instanceof Action)) {
            return [];
        }
        return [
            ...entity.getActions(),
            {},
            {
                caption: 'Remove recent',
                handler: () => {
                    this.storage().remove([entity.uuid]);
                },
            },
            {
                caption: 'Clear All',
                handler: () => {
                    this.storage().removeAll();
                },
            },
        ];
    }

    public title(): string {
        return `Recent action(s)`;
    }

    public getNoContentActions(): INoContentActions {
        return {
            title: `As soon as some file/source will be opened, recent actions will be shown here`,
            buttons: [],
        };
    }
}
