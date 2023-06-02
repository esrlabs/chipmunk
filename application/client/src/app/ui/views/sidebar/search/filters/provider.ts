import { Entity } from '../providers/definitions/entity';
import { Provider } from '../providers/definitions/provider';
import { FilterRequest } from '@service/session/dependencies/search/filters/store';
import { DisabledRequest } from '@service/session/dependencies/search/disabled/request';
import { IComponentDesc } from '@elements/containers/dynamic/component';
import { FiltersList } from './list/component';
import { FiltersPlaceholder } from './placeholder/component';
import { FilterDetails } from './details/component';
import { IMenuItem } from '@ui/service/contextmenu';
import { ChartRequest } from '@service/session/dependencies/search/charts/request';

export class ProviderFilters extends Provider<FilterRequest> {
    private _entities: Map<string, Entity<FilterRequest>> = new Map();

    public init(): void {
        this.updatePanels();
        this.register(
            this.session.search
                .store()
                .filters()
                .subjects.get()
                .value.subscribe(() => {
                    super.change();
                }),
        );
        this.register(
            this.session.search.subjects.get().updated.subscribe((event) => {
                this._entities.forEach((entity) => {
                    const alias = entity.extract().alias();
                    entity
                        .extract()
                        .set()
                        .found(event.stat[alias] === undefined ? 0 : event.stat[alias]);
                });
            }),
        );
    }

    public entities(): Array<Entity<FilterRequest>> {
        const guids: string[] = [];
        const entities = this.session.search
            .store()
            .filters()
            .get()
            .map((filter: FilterRequest) => {
                let entity = this._entities.get(filter.definition.uuid);
                if (entity === undefined) {
                    entity = new Entity<FilterRequest>(filter);
                } else {
                    entity.set(filter);
                }
                this._entities.set(filter.definition.uuid, entity);
                guids.push(filter.definition.uuid);
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
        this.session.search.store().filters().reorder(params);
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
                        return `Filters`;
                    },
                    desc: (): string => {
                        const count = this.entities().length;
                        return `${count} filter${count > 1 ? 's' : ''}`;
                    },
                    comp: (): IComponentDesc => {
                        return {
                            factory: FiltersList,
                            inputs: {
                                provider: this,
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
                        return `Filter Details`;
                    },
                    desc: (): string | undefined => {
                        if (this.select().get().length !== 1) {
                            return '';
                        }
                        const selection = this._entities.get(this.select().get()[0]);
                        if (selection === undefined) {
                            return '';
                        }
                        return selection.extract().definition.filter.filter;
                    },
                    comp: (): IComponentDesc | undefined => {
                        return {
                            factory: FilterDetails,
                            inputs: {
                                provider: this,
                            },
                        };
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
                        return `Filters`;
                    },
                    desc: (): string | undefined => {
                        return undefined;
                    },
                    comp: (): IComponentDesc | undefined => {
                        return {
                            factory: FiltersPlaceholder,
                            inputs: {
                                provider: this,
                            },
                        };
                    },
                };
            },
        };
    }

    public getContextMenuItems(_target: Entity<any>, selected: Array<Entity<any>>): IMenuItem[] {
        if (selected.length !== 1) {
            return [];
        }
        const entity = selected[0].extract();
        const items: IMenuItem[] = [];
        if (selected[0].extract() instanceof FilterRequest) {
            items.push(
                ...[
                    {
                        caption: `Show Matches`,
                        handler: () => {
                            this.search(selected[0]);
                        },
                    },
                    {},
                    {
                        caption: `Into Chart`,
                        disabled: !this.session.search.store().charts().isConvertableFrom(entity),
                        handler: () => {
                            if (!this.session.search.store().charts().tryFromFilter(entity)) {
                                return;
                            }
                            this.session.search.store().filters().delete([entity.uuid()]);
                        },
                    },
                ],
            );
        }
        return items;
    }

    public search(entity: Entity<FilterRequest>) {
        this.session.switch().toolbar.search();
        this.session.search
            .state()
            .setActive(entity.extract().definition.filter)
            .catch((error: Error) => {
                this.logger.error(`Fail to make search: ${error.message}`);
            });
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
        const actions: {
            activate?: () => void;
            deactivate?: () => void;
            remove?: () => void;
            edit?: () => void;
        } = {};
        const self = this;
        const entities = selected.filter((entity: Entity<any>) => {
            return entity.extract() instanceof FilterRequest;
        });
        actions.activate =
            entities.filter((entity: Entity<FilterRequest>) => {
                return entity.extract().definition.active === false;
            }).length !== 0
                ? () => {
                      entities.forEach((entity: Entity<FilterRequest>) => {
                          entity.extract().set().state(true);
                      });
                  }
                : undefined;
        actions.deactivate =
            entities.filter((entity: Entity<FilterRequest>) => {
                return entity.extract().definition.active === true;
            }).length !== 0
                ? () => {
                      entities.forEach((entity: Entity<FilterRequest>) => {
                          entity.extract().set().state(false);
                      });
                  }
                : undefined;
        actions.edit =
            selected.length === 1 && entities.length === 1
                ? () => {
                      // View should be focused to switch to edit-mode, but while context
                      // menu is open, there are no focus. Well, that's why settimer here.
                      setTimeout(() => {
                          self.edit().in();
                      });
                  }
                : undefined;
        actions.remove =
            entities.length !== 0
                ? () => {
                      if (entities.length === self.entities().length) {
                          this.session.search
                              .store()
                              .filters()
                              .clear()
                              .catch((error: Error) => {
                                  this.logger.error(`Fail to clear store: ${error.message}`);
                              });
                          self.change();
                      } else {
                          entities.forEach((entity: Entity<FilterRequest>) => {
                              this.session.search.store().filters().delete([entity.uuid()]);
                          });
                      }
                  }
                : undefined;
        return actions;
    }

    public tryToInsertEntity(entity: unknown, _index: number): boolean {
        if (entity instanceof ChartRequest) {
            if (
                this.session.search
                    .store()
                    .filters()
                    .addFromFilter({
                        filter: entity.as().filter(),
                        flags: { reg: true, word: false, cases: false },
                    })
            ) {
                this.session.search.store().charts().delete([entity.uuid()]);
                return true;
            } else {
                return false;
            }
        } else if (entity instanceof DisabledRequest) {
            if (this.session.search.store().filters().tryRestore(entity.entity())) {
                this.session.search.store().disabled().delete([entity.uuid()]);
                return true;
            } else {
                return false;
            }
        }
        return false;
    }

    public removeEntity(entity: unknown): boolean {
        if (!(entity instanceof FilterRequest)) {
            return false;
        }
        this.session.search.store().filters().delete([entity.uuid()]);
        return true;
    }
}
