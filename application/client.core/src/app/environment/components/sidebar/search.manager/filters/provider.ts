import { Entity } from '../providers/entity';
import { Provider } from '../providers/provider';
import {
    FilterRequest,
    IFiltersStorageUpdated,
} from '../../../../controller/session/dependencies/search/dependencies/filters/controller.session.tab.search.filters.storage';
import { ChartRequest } from '../../../../controller/session/dependencies/search/dependencies/charts/controller.session.tab.search.charts.storage';
import { DisabledRequest } from '../../../../controller/session/dependencies/search/dependencies/disabled/controller.session.tab.search.disabled';
import { IComponentDesc } from 'chipmunk-client-material';
import { Session } from '../../../../controller/session/session';
import { Subscription } from 'rxjs';
import { SidebarAppSearchManagerFiltersComponent } from './list/component';
import { SidebarAppSearchManagerFiltersPlaceholderComponent } from './placeholder/component';
import { SidebarAppSearchManagerFilterDetailsComponent } from './details/component';
import { IMenuItem } from '../../../../services/standalone/service.contextmenu';
import { Logger } from 'chipmunk.client.toolkit';
import SearchManagerService, { TRequest, EListID } from '../service/service';
import { CdkDragDrop } from '@angular/cdk/drag-drop';
import { EntityData } from '../providers/entity.data';

export class ProviderFilters extends Provider<FilterRequest> {
    private _subs: { [key: string]: Subscription } = {};
    private _entities: Map<string, Entity<FilterRequest>> = new Map();
    private _logger: Logger = new Logger('ProviderFilters');
    private _listID: EListID = EListID.filtersList;

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
            .getFiltersAPI()
            .getStorage()
            .getObservable()
            .updated.subscribe((event?: IFiltersStorageUpdated) => {
                super.change();
                if (event === undefined) {
                    return;
                }
                if (event.added instanceof FilterRequest) {
                    this.select().set({
                        guid: event.added.getGUID(),
                        sender: undefined,
                        ignore: true,
                    });
                    super.change();
                }
                if (event.removed instanceof FilterRequest || event.requests.length === 0) {
                    this.select().drop();
                }
            });
    }

    public get(): Array<Entity<FilterRequest>> {
        const guids: string[] = [];
        const session = super.getSession();
        const entities =
            session === undefined
                ? []
                : session
                      .getSessionSearch()
                      .getFiltersAPI()
                      .getStorage()
                      .get()
                      .map((filter: FilterRequest) => {
                          let entity = this._entities.get(filter.getGUID());
                          if (entity === undefined) {
                              entity = new Entity<FilterRequest>(filter, filter.getGUID());
                          } else {
                              entity.setEntity(filter);
                          }
                          this._entities.set(filter.getGUID(), entity);
                          guids.push(filter.getGUID());
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
        session.getSessionSearch().getFiltersAPI().getStorage().reorder(params);
        super.change();
    }

    public getContentIfEmpty(): IComponentDesc {
        return {
            factory: SidebarAppSearchManagerFiltersPlaceholderComponent,
            inputs: {
                provider: this,
            },
        };
    }

    public getPanelName(): string {
        return `Filters`;
    }

    public getPanelDesc(): string {
        const count = this.get().length;
        return `${count} filter${count > 1 ? 's' : ''}`;
    }

    public getDetailsPanelName(): string {
        return `Filter Details`;
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
            factory: SidebarAppSearchManagerFiltersComponent,
            inputs: {
                provider: this,
            },
        };
    }

    public getDetailsComp(): IComponentDesc {
        return {
            factory: SidebarAppSearchManagerFilterDetailsComponent,
            inputs: {
                provider: this,
            },
        };
    }

    public getContextMenuItems(target: Entity<any>, selected: Array<Entity<any>>): IMenuItem[] {
        if (selected.length !== 1) {
            return [];
        }
        const session = super.getSession();
        if (session === undefined) {
            return [];
        }
        const entity: ChartRequest = selected[0].getEntity();
        const items: IMenuItem[] = [];
        if (entity instanceof ChartRequest && FilterRequest.isValid(entity.asDesc().request)) {
            items.push({
                caption: `Convert To Filter`,
                handler: () => {
                    session.getSessionSearch().getChartsAPI().getStorage().remove(entity);
                    session
                        .getSessionSearch()
                        .getFiltersAPI()
                        .getStorage()
                        .add({
                            request: entity.asDesc().request,
                            flags: {
                                casesensitive: true,
                                wholeword: true,
                                regexp: true,
                            },
                        });
                },
            });
        }
        if (entity instanceof FilterRequest) {
            items.push({
                caption: `Show Matches`,
                handler: () => {
                    this.search(selected[0]);
                },
            });
        }
        return items;
    }

    public search(entity: Entity<FilterRequest>) {
        const session = super.getSession();
        if (session === undefined) {
            return;
        }
        super
            .openSearchToolbarApp()
            .then(() => {
                session.getSessionSearch().search(entity.getEntity());
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
            return entity.getEntity() instanceof FilterRequest;
        });
        actions.activate =
            entities.filter((entity: Entity<FilterRequest>) => {
                return entity.getEntity().getState() === false;
            }).length !== 0
                ? () => {
                      entities.forEach((entity: Entity<FilterRequest>) => {
                          entity.getEntity().setState(true);
                      });
                  }
                : undefined;
        actions.deactivate =
            entities.filter((entity: Entity<FilterRequest>) => {
                return entity.getEntity().getState() === true;
            }).length !== 0
                ? () => {
                      entities.forEach((entity: Entity<FilterRequest>) => {
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
                          session.getSessionSearch().getFiltersAPI().getStorage().clear();
                          self.change();
                      } else {
                          entities.forEach((entity: Entity<FilterRequest>) => {
                              session
                                  .getSessionSearch()
                                  .getFiltersAPI()
                                  .getStorage()
                                  .remove(entity.getEntity());
                          });
                      }
                  }
                : undefined;
        return actions;
    }

    public isViable(): boolean {
        const dragging: Entity<TRequest> = SearchManagerService.dragging;
        if (dragging) {
            const request: TRequest = dragging.getEntity();
            if (request instanceof DisabledRequest) {
                if ((request as DisabledRequest).getEntity() instanceof FilterRequest) {
                    return true;
                }
                return false;
            } else if (request instanceof ChartRequest || request instanceof FilterRequest) {
                return true;
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
                    outside.getEntity().getEntity() instanceof FilterRequest
                ) {
                    session
                        .getSessionSearch()
                        .getDisabledAPI()
                        .getStorage()
                        .remove(outside.getEntity());
                    session
                        .getSessionSearch()
                        .getFiltersAPI()
                        .getStorage()
                        .add(outside.getEntity().getEntity() as FilterRequest, event.currentIndex);
                }
            } else if (data.entries !== undefined) {
                const outside: Entity<ChartRequest> | undefined =
                    data.entries[event.previousIndex] !== undefined
                        ? (data.entries[index] as Entity<ChartRequest>)
                        : undefined;
                if (
                    outside !== undefined &&
                    typeof outside.getEntity === 'function' &&
                    outside.getEntity() instanceof ChartRequest
                ) {
                    session
                        .getSessionSearch()
                        .getChartsAPI()
                        .getStorage()
                        .remove(outside.getEntity());
                    session
                        .getSessionSearch()
                        .getFiltersAPI()
                        .getStorage()
                        .add(
                            {
                                request: outside.getEntity().asDesc().request,
                                flags: {
                                    casesensitive: true,
                                    wholeword: true,
                                    regexp: true,
                                },
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
