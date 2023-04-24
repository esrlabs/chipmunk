import { Entity } from '../providers/definitions/entity';
import { Provider } from '../providers/definitions/provider';
import { ChartRequest } from '@service/session/dependencies/search/charts/store';
import { DisabledRequest } from '@service/session/dependencies/search/disabled/request';
import { IComponentDesc } from '@elements/containers/dynamic/component';
import { ChartsList } from './list/component';
import { ChartDetails } from './details/component';
import { IMenuItem } from '@ui/service/contextmenu';
import { DragableRequest, ListContent } from '../draganddrop/service';
import { CdkDragDrop } from '@angular/cdk/drag-drop';
import { EntityData } from '../providers/definitions/entity.data';
import { FilterRequest } from '@service/session/dependencies/search/filters/request';
import { StoredEntity } from '@service/session/dependencies/search/store';

export class ProviderCharts extends Provider<ChartRequest> {
    private _entities: Map<string, Entity<ChartRequest>> = new Map();
    private _listID: ListContent = ListContent.chartsList;

    public init(): void {
        this.updatePanels();
        this.subscriber.register(
            this.session.search
                .store()
                .charts()
                .subjects.get()
                .value.subscribe(() => {
                    super.change();
                }),
        );
    }

    public entities(): Array<Entity<ChartRequest>> {
        const guids: string[] = [];
        const entities = this.session.search
            .store()
            .charts()
            .get()
            .map((chart: ChartRequest) => {
                let entity = this._entities.get(chart.definition.uuid);
                if (entity === undefined) {
                    entity = new Entity<ChartRequest>(chart);
                } else {
                    entity.set(chart);
                }
                this._entities.set(chart.definition.uuid, entity);
                guids.push(chart.definition.uuid);
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
        this.session.search.store().charts().reorder(params);
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
                        return `Charts`;
                    },
                    desc: (): string => {
                        const count = this.entities().length;
                        return `${count} chart${count > 1 ? 's' : ''}`;
                    },
                    comp: (): IComponentDesc => {
                        return {
                            factory: ChartsList,
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
                        return `Chart Details`;
                    },
                    desc: (): string | undefined => {
                        if (this.select().get().length !== 1) {
                            return '';
                        }
                        const selection = this._entities.get(this.select().get()[0]);
                        if (selection === undefined) {
                            return '';
                        }
                        return selection.extract().definition.filter;
                    },
                    comp: (): IComponentDesc | undefined => {
                        return {
                            factory: ChartDetails,
                            inputs: {
                                provider: this,
                                draganddrop: this.draganddrop,
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
        if (selected.length !== 1) {
            return [];
        }
        const entity = selected[0];
        const request = entity.extract();
        const items: IMenuItem[] = [];
        const flags = {
            cases: false,
            word: false,
            reg: true,
        };
        if (
            request instanceof ChartRequest &&
            FilterRequest.isValid({ filter: request.definition.filter, flags: flags })
        ) {
            items.push({
                caption: `Convert to Filter`,
                handler: () => {
                    this.session.search.store().charts().delete([request.uuid()]);
                    this.session.search
                        .store()
                        .filters()
                        .update([FilterRequest.fromChart(request) as StoredEntity<FilterRequest>]);
                },
            });
        }
        return items;
    }

    public search(_: Entity<ChartRequest>) {
        // Not available for charts
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
            return entity.extract() instanceof ChartRequest;
        });
        actions.activate =
            entities.filter((entity: Entity<ChartRequest>) => {
                return entity.extract().definition.active === false;
            }).length !== 0
                ? () => {
                      entities.forEach((entity: Entity<ChartRequest>) => {
                          entity.extract().set().state(true);
                      });
                  }
                : undefined;
        actions.deactivate =
            entities.filter((entity: Entity<ChartRequest>) => {
                return entity.extract().definition.active === true;
            }).length !== 0
                ? () => {
                      entities.forEach((entity: Entity<ChartRequest>) => {
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
                              .charts()
                              .clear()
                              .catch((error: Error) => {
                                  this.logger.error(`Fail to clear store: ${error.message}`);
                              });
                          self.change();
                      } else {
                          entities.forEach((entity: Entity<ChartRequest>) => {
                              this.session.search.store().charts().delete([entity.uuid()]);
                          });
                      }
                  }
                : undefined;
        return actions;
    }

    public isVisable(): boolean {
        const dragging: Entity<DragableRequest> = this.draganddrop.dragging;
        if (dragging) {
            const request: DragableRequest = dragging.extract();
            if (request instanceof DisabledRequest) {
                if ((request as DisabledRequest).entity() instanceof ChartRequest) {
                    return true;
                }
                return false;
            } else if (request instanceof FilterRequest) {
                return true;
            }
        }
        return false;
    }

    public dropped(event: CdkDragDrop<EntityData<DragableRequest>>) {
        if (event.previousContainer === event.container) {
            this.reorder({ prev: event.previousIndex, curt: event.currentIndex });
        } else {
            const index: number = event.previousIndex;
            const data: EntityData<DragableRequest> = event.previousContainer.data;
            if (data.disabled !== undefined) {
                const outside: Entity<DisabledRequest> | undefined =
                    data.disabled[event.previousIndex] !== undefined
                        ? data.disabled[index]
                        : undefined;
                if (outside === undefined) {
                    return;
                }
                const disabled: DisabledRequest = outside.extract();
                this.session.search.store().disabled().delete([disabled.uuid()]);
                this.session.search
                    .store()
                    .charts()
                    .update([disabled.entity() as StoredEntity<ChartRequest>]);
            } else {
                if (data.entries !== undefined && data.entries.length > 0) {
                    const entry: Entity<FilterRequest> = data.entries[0] as Entity<FilterRequest>;
                    const filterRequest: FilterRequest = entry.extract();
                    if (ChartRequest.isValid(filterRequest.definition.filter.filter)) {
                        this.session.search.store().filters().delete([filterRequest.uuid()]);
                        this.session.search
                            .store()
                            .charts()
                            .update([
                                ChartRequest.fromFilter(
                                    filterRequest,
                                ) as StoredEntity<ChartRequest>,
                            ]);
                    }
                }
            }
        }
    }

    public get listID(): ListContent {
        return this._listID;
    }
}
