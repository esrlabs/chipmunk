import { Entity } from '../providers/entity';
import { Provider } from '../providers/provider';
import {
    ChartRequest,
    IChartsStorageUpdated,
} from '../../../../controller/session/dependencies/search/dependencies/charts/controller.session.tab.search.charts.storage';
import { FilterRequest } from '../../../../controller/session/dependencies/search/dependencies/filters/controller.session.tab.search.filters';
import { DisabledRequest } from '../../../../controller/session/dependencies/search/dependencies/disabled/controller.session.tab.search.disabled';
import { IComponentDesc } from 'chipmunk-client-material';
import { Session } from '../../../../controller/session/session';
import { Subscription } from 'rxjs';
import { CdkDragDrop } from '@angular/cdk/drag-drop';
import { SidebarAppSearchManagerChartsComponent } from './list/component';
import { SidebarAppSearchManagerChartDetailsComponent } from './details/component';
import { IMenuItem } from '../../../../services/standalone/service.contextmenu';
import { EChartType } from '../../../../components/views/chart/charts/charts';
import { Logger } from 'chipmunk.client.toolkit';
import { EntityData } from '../providers/entity.data';
import SearchManagerService, { TRequest, EListID } from '../service/service';

export class ProviderCharts extends Provider<ChartRequest> {
    private _subs: { [key: string]: Subscription } = {};
    private _entities: Map<string, Entity<ChartRequest>> = new Map();
    private _logger: Logger = new Logger('ProviderCharts');
    private _listID: EListID = EListID.chartsList;

    constructor() {
        super();
        this.setSessionController(super.getSession());
    }

    public unsubscribe() {
        this._subs !== undefined &&
            Object.keys(this._subs).forEach((key: string) => {
                this._subs[key].unsubscribe();
            });
    }

    public setSessionController(session: Session | undefined) {
        this.unsubscribe();
        if (session === undefined) {
            return;
        }
        this._subs.updated = session
            .getSessionSearch()
            .getChartsAPI()
            .getStorage()
            .getObservable()
            .updated.subscribe((event?: IChartsStorageUpdated) => {
                super.change();
                if (event === undefined) {
                    return;
                }
                if (event.added instanceof ChartRequest) {
                    this.select().set({
                        guid: event.added.getGUID(),
                        sender: undefined,
                        ignore: true,
                    });
                }
                if (event.removed instanceof ChartRequest || event.requests.length === 0) {
                    this.select().drop();
                }
            });
    }

    public get(): Array<Entity<ChartRequest>> {
        const guids: string[] = [];
        const session = super.getSession();
        const entities =
            session === undefined
                ? []
                : session
                      .getSessionSearch()
                      .getChartsAPI()
                      .getStorage()
                      .get()
                      .map((chart: ChartRequest) => {
                          let entity = this._entities.get(chart.getGUID());
                          if (entity === undefined) {
                              entity = new Entity<ChartRequest>(chart, chart.getGUID());
                          } else {
                              entity.setEntity(chart);
                          }
                          this._entities.set(chart.getGUID(), entity);
                          guids.push(chart.getGUID());
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
        const session = super.getSession();
        if (session === undefined) {
            return;
        }
        session.getSessionSearch().getChartsAPI().getStorage().reorder(params);
        super.change();
    }

    public getContentIfEmpty(): undefined {
        return undefined;
    }

    public getPanelName(): string {
        return `Charts`;
    }

    public getPanelDesc(): string {
        const count = this.get().length;
        return `${count} chart${count > 1 ? 's' : ''}`;
    }

    public getDetailsPanelName(): string {
        return `Chart Details`;
    }

    public getDetailsPanelDesc(): string {
        if (this.select().get().length !== 1) {
            return '';
        }
        const selection = this._entities.get(this.select().get()[0]);
        if (selection === undefined) {
            return '';
        }
        return selection.getEntity().asDesc().request;
    }

    public getListComp(): IComponentDesc {
        return {
            factory: SidebarAppSearchManagerChartsComponent,
            inputs: {
                provider: this,
            },
        };
    }

    public getDetailsComp(): IComponentDesc {
        return {
            factory: SidebarAppSearchManagerChartDetailsComponent,
            inputs: {
                provider: this,
            },
        };
    }

    public getContextMenuItems(target: Entity<any>, selected: Array<Entity<any>>): IMenuItem[] {
        const session = super.getSession();
        if (session === undefined) {
            return [];
        }
        if (selected.length !== 1) {
            return [];
        }
        const entity: FilterRequest = selected[0].getEntity();
        const items: IMenuItem[] = [];
        if (entity instanceof FilterRequest && ChartRequest.isValid(entity.asDesc().request)) {
            items.push({
                caption: `Convert To Chart`,
                handler: () => {
                    session.getSessionSearch().getFiltersAPI().getStorage().remove(entity);
                    session.getSessionSearch().getChartsAPI().getStorage().add({
                        request: entity.asDesc().request,
                        type: EChartType.smooth,
                    });
                },
            });
        }
        if (entity instanceof ChartRequest) {
            items.push({
                caption: `Show Matches`,
                handler: () => {
                    this.search(selected[0]);
                },
            });
        }
        return items;
    }

    public search(entity: Entity<ChartRequest>) {
        const session = super.getSession();
        if (session === undefined) {
            return;
        }
        super
            .openSearchToolbarApp()
            .then(() => {
                session.getSessionSearch().search(
                    new FilterRequest({
                        request: (entity.getEntity() as ChartRequest).asDesc().request,
                        flags: {
                            casesensitive: false,
                            wholeword: false,
                            regexp: true,
                        },
                    }),
                );
            })
            .catch((error: Error) => {
                this._logger.error(`Failed to show matches due to error: ${error.message}`);
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
            return entity.getEntity() instanceof ChartRequest;
        });
        actions.activate =
            entities.filter((entity: Entity<ChartRequest>) => {
                return entity.getEntity().getState() === false;
            }).length !== 0
                ? () => {
                      entities.forEach((entity: Entity<ChartRequest>) => {
                          entity.getEntity().setState(true);
                      });
                  }
                : undefined;
        actions.deactivate =
            entities.filter((entity: Entity<ChartRequest>) => {
                return entity.getEntity().getState() === true;
            }).length !== 0
                ? () => {
                      entities.forEach((entity: Entity<ChartRequest>) => {
                          entity.getEntity().setState(false);
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
                      const session = super.getSession();
                      if (session === undefined) {
                          return;
                      }
                      if (entities.length === self.get().length) {
                          session.getSessionSearch().getChartsAPI().getStorage().clear();
                          self.change();
                      } else {
                          entities.forEach((entity: Entity<ChartRequest>) => {
                              session
                                  .getSessionSearch()
                                  .getChartsAPI()
                                  .getStorage()
                                  .remove(entity.getEntity());
                          });
                      }
                  }
                : undefined;
        return actions;
    }

    public isViable(): boolean {
        const dragging: Entity<TRequest> | undefined = SearchManagerService.dragging;
        if (dragging) {
            const request: TRequest = dragging.getEntity();
            if (request instanceof DisabledRequest) {
                if ((request as DisabledRequest).getEntity() instanceof ChartRequest) {
                    return true;
                }
                return false;
            } else if (request instanceof ChartRequest) {
                return true;
            } else if (request instanceof FilterRequest) {
                return ChartRequest.isValid((request as FilterRequest).asDesc().request);
            }
        }
        return false;
    }

    public itemDragged(event: CdkDragDrop<EntityData<TRequest>>) {
        const session = super.getSession();
        if (session === undefined) {
            return;
        }
        if (event.previousContainer === event.container) {
            this.reorder({ prev: event.previousIndex, curt: event.currentIndex });
        } else {
            const index: number = event.previousIndex;
            const data: EntityData<TRequest> = event.previousContainer.data;
            if (data.disabled !== undefined) {
                const outside: Entity<DisabledRequest> | undefined =
                    data.disabled[event.previousIndex] !== undefined
                        ? data.disabled[index]
                        : undefined;
                if (
                    outside !== undefined &&
                    typeof outside.getEntity().getEntity === 'function' &&
                    outside.getEntity().getEntity() instanceof ChartRequest
                ) {
                    session
                        .getSessionSearch()
                        .getDisabledAPI()
                        .getStorage()
                        .remove(outside.getEntity());
                    session
                        .getSessionSearch()
                        .getChartsAPI()
                        .getStorage()
                        .add(outside.getEntity().getEntity() as ChartRequest, event.currentIndex);
                }
            } else if (data.entries !== undefined) {
                const outside: Entity<FilterRequest> | undefined =
                    data.entries[event.previousIndex] !== undefined
                        ? (data.entries[index] as Entity<FilterRequest>)
                        : undefined;
                if (
                    outside !== undefined &&
                    typeof outside.getEntity === 'function' &&
                    outside.getEntity() instanceof FilterRequest
                ) {
                    session
                        .getSessionSearch()
                        .getFiltersAPI()
                        .getStorage()
                        .remove(outside.getEntity());
                    session.getSessionSearch().getChartsAPI().getStorage().add(
                        {
                            request: outside.getEntity().asDesc().request,
                            type: EChartType.smooth,
                        },
                        event.currentIndex,
                    );
                }
            }
        }
    }

    public get listID(): EListID {
        return this._listID;
    }
}
