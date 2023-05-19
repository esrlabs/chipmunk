import { Entity } from '../providers/definitions/entity';
import { Provider } from '../providers/definitions/provider';
import { DisabledRequest } from '@service/session/dependencies/search/disabled/store';
import { IComponentDesc } from '@elements/containers/dynamic/component';
import { DisabledList } from './list/component';
import { IMenuItem } from '@ui/service/contextmenu';
import { DisableConvertable } from '@service/session/dependencies/search/disabled/converting';
import { FilterRequest } from '@service/session/dependencies/search/filters/request';
import { ChartRequest } from '@service/session/dependencies/search/charts/request';
import { CdkDragDrop } from '@angular/cdk/drag-drop';
import { DragableRequest, ListContent } from '../draganddrop/service';
import { EntityData } from '../providers/definitions/entity.data';

export class ProviderDisabled extends Provider<DisabledRequest> {
    private readonly _entities: Map<string, Entity<DisabledRequest>> = new Map();
    private readonly _listID: ListContent = ListContent.disabledList;

    public init(): void {
        super.updatePanels();
        this.subscriber.register(
            this.session.search
                .store()
                .disabled()
                .subjects.get()
                .value.subscribe(() => {
                    super.change();
                    this.select().drop();
                }),
        );
    }

    public entities(): Array<Entity<DisabledRequest>> {
        const guids: string[] = [];
        const entities = this.session.search
            .store()
            .disabled()
            .get()
            .map((item: DisabledRequest) => {
                let entity = this._entities.get(item.uuid());
                if (entity === undefined) {
                    entity = new Entity<DisabledRequest>(item);
                } else {
                    entity.set(item);
                }
                this._entities.set(item.uuid(), entity);
                guids.push(item.uuid());
                return entity;
            });
        this._entities.forEach((_, guid: string) => {
            if (guids.indexOf(guid) === -1) {
                this._entities.delete(guid);
            }
        });
        return entities;
    }

    public reorder(params: { prev: number; curt: number }) {
        this.session.search.store().disabled().reorder(params);
        super.change();
    }

    public getPanels(): {
        list(): {
            name(): string;
            desc(): string;
            comp(): IComponentDesc;
        };
        details(): {
            name(): string | undefined;
            desc(): string | undefined;
            comp(): IComponentDesc | undefined;
        };
        nocontent(): {
            name(): string | undefined;
            desc(): string | undefined;
            comp(): IComponentDesc | undefined;
        };
    } {
        return {
            list: (): {
                name(): string;
                desc(): string;
                comp(): IComponentDesc;
            } => {
                return {
                    name: (): string => {
                        return `Disabled`;
                    },
                    desc: (): string => {
                        const count = this.entities().length;
                        return `${count} ${count > 1 ? 'entities' : 'entity'}`;
                    },
                    comp: (): IComponentDesc => {
                        return {
                            factory: DisabledList,
                            inputs: {
                                provider: this,
                                draganddrop: this.draganddrop,
                                session: this.session,
                            },
                        };
                    },
                };
            },
            details: (): {
                name(): string | undefined;
                desc(): string | undefined;
                comp(): IComponentDesc | undefined;
            } => {
                return {
                    name: (): string | undefined => {
                        return undefined;
                    },
                    desc: (): string | undefined => {
                        return undefined;
                    },
                    comp: (): IComponentDesc | undefined => {
                        return undefined;
                    },
                };
            },
            nocontent: (): {
                name(): string | undefined;
                desc(): string | undefined;
                comp(): IComponentDesc | undefined;
            } => {
                return {
                    name: (): string | undefined => {
                        return undefined;
                    },
                    desc: (): string | undefined => {
                        return undefined;
                    },
                    comp: (): IComponentDesc | undefined => {
                        return undefined;
                    },
                };
            },
        };
    }

    public getContextMenuItems(target: Entity<any>, selected: Array<Entity<any>>): IMenuItem[] {
        const entities: DisableConvertable[] = selected
            .filter((entity: Entity<any>) => {
                return !(entity.extract() instanceof DisabledRequest);
            })
            .map((entity: Entity<any>) => {
                return entity.extract();
            });
        const disableds: DisabledRequest[] = selected
            .filter((entity: Entity<any>) => {
                return entity.extract() instanceof DisabledRequest;
            })
            .map((entity: Entity<any>) => {
                return entity.extract();
            });
        const items: IMenuItem[] = [];
        if (entities.length > 0 && disableds.length === 0) {
            items.push({
                caption: `Disable`,
                handler: () => {
                    this.session.search.store().disabled().addFromEntity(entities);
                    this.session.search
                        .store()
                        .filters()
                        .delete(entities.map((en) => en.uuid()));
                },
            });
        }
        if (entities.length === 0 && disableds.length > 0) {
            items.push({
                caption: `Enable`,
                handler: () => {
                    disableds.forEach((disabled: DisabledRequest) => {
                        let restored = false;
                        !restored &&
                            (restored = this.session.search
                                .store()
                                .filters()
                                .tryRestore(disabled.entity()));
                        !restored &&
                            (restored = this.session.search
                                .store()
                                .charts()
                                .tryRestore(disabled.entity()));
                        restored &&
                            this.session.search.store().disabled().delete([disabled.uuid()]);
                    });
                },
            });
        }
        return items;
    }

    public search(target: Entity<any>) {
        const entity = target.extract();
        if (entity instanceof ChartRequest) {
            this.session.search
                .state()
                .setActive({
                    filter: entity.definition.filter,
                    flags: { reg: true, word: false, cases: false },
                })
                .catch((error: Error) => {
                    this.logger.error(`Fail to make search: ${error.message}`);
                });
        } else if (entity instanceof FilterRequest) {
            this.session.search
                .state()
                .setActive(entity.definition.filter)
                .catch((error: Error) => {
                    this.logger.error(`Fail to make search: ${error.message}`);
                });
        }
    }

    public actions(
        target: Entity<any>,
        selected: Array<Entity<any>>,
    ): {
        activate?: () => void;
        deactivate?: () => void;
        remove?: () => void;
        edit?: () => void;
    } {
        const disableds: DisabledRequest[] = selected
            .filter((entity: Entity<any>) => {
                return entity.extract() instanceof DisabledRequest;
            })
            .map((entity: Entity<any>) => {
                return entity.extract();
            });
        return {
            remove:
                disableds.length !== 0
                    ? () => {
                          disableds.forEach((disabled: DisabledRequest) => {
                              this.session.search.store().disabled().delete([disabled.uuid()]);
                          });
                      }
                    : undefined,
        };
    }

    // Method because of abstract class, not used
    public isVisable() {
        return true;
    }

    public dropped(event: CdkDragDrop<EntityData<DragableRequest>>) {
        if (event.previousContainer === event.container) {
            this.reorder({ prev: event.previousIndex, curt: event.currentIndex });
        } else {
            const index: number = event.previousIndex;
            const data: EntityData<DragableRequest> = event.previousContainer.data;
            if (data.entries !== undefined) {
                const outside: Entity<DragableRequest> | undefined =
                    data.entries[event.previousIndex] !== undefined
                        ? data.entries[index]
                        : undefined;
                if (outside === undefined) {
                    return;
                }
                const extracted = outside.extract();
                if (extracted instanceof DisabledRequest) {
                    return;
                }
                this.session.search.store().disabled().addFromEntity([extracted]);
                extracted instanceof FilterRequest &&
                    this.session.search.store().filters().delete([extracted.uuid()]);
                extracted instanceof ChartRequest &&
                    this.session.search.store().charts().delete([extracted.uuid()]);
            }
        }
    }

    public get listID(): ListContent {
        return this._listID;
    }
}
