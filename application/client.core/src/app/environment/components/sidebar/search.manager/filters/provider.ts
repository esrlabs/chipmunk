import { Entity } from '../providers/entity';
import { Provider } from '../providers/provider';
import { FilterRequest, IFiltersStorageUpdated } from '../../../../controller/controller.session.tab.search.filters.storage';
import { ChartRequest  } from '../../../../controller/controller.session.tab.search.charts.storage';
import { IComponentDesc } from 'chipmunk-client-material';
import { ControllerSessionTab } from '../../../../controller/controller.session.tab';
import { Subject, Observable, Subscription } from 'rxjs';
import { SidebarAppSearchManagerFiltersComponent } from './list/component';
import { SidebarAppSearchManagerFilterDetailsComponent } from './details/component';
import { IMenuItem } from '../../../../services/standalone/service.contextmenu';
import ToolbarSessionsService from '../../../../services/service.sessions.toolbar';
import { Logger } from 'chipmunk.client.toolkit';

export class ProviderFilters extends Provider<FilterRequest> {

    private _subs: { [key: string]: Subscription } = {};
    private _entities: Map<string, Entity<FilterRequest>> = new Map();
    private _logger: Logger = new Logger('ProviderFilters');

    constructor() {
        super();
        this.setSessionController(super.getSession());
    }

    public unsubscribe() {
        this._subs !== undefined && Object.keys(this._subs).forEach((key: string) => {
            this._subs[key].unsubscribe();
        });
    }

    public setSessionController(session: ControllerSessionTab | undefined) {
        this.unsubscribe();
        if (session === undefined) {
            return;
        }
        this._subs.updated = session.getSessionSearch().getFiltersAPI().getStorage().getObservable().updated.subscribe((event?: IFiltersStorageUpdated) => {
            super.update();
            if (event === undefined) {
                return;
            }
            if (event.added instanceof FilterRequest) {
                this.select().set({
                    guid: event.added.getGUID(),
                    sender: undefined,
                    ignore: true
                });
            }
            if (event.removed instanceof FilterRequest || event.requests.length === 0) {
                this.select().drop();
            }
        });
    }

    public get(): Array<Entity<FilterRequest>> {
        const guids: string[] = [];
        const entities = super.getSession() === undefined ? [] : super.getSession().getSessionSearch().getFiltersAPI().getStorage().get().map((filter: FilterRequest) => {
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

    public reorder(params: {
        prev: number,
        curt: number,
    }) {
        if (super.getSession() === undefined) {
            return;
        }
        super.getSession().getSessionSearch().getFiltersAPI().getStorage().reorder(params);
        super.update();
    }

    public getContentIfEmpty(): string | undefined {
        return `No filters are stored`;
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
        const entity: ChartRequest = selected[0].getEntity();
        const items: IMenuItem[] = [];
        if (entity instanceof ChartRequest && FilterRequest.isValid(entity.asDesc().request)) {
            items.push({
                caption: `Convert To Filter`,
                handler: () => {
                    super.getSession().getSessionSearch().getChartsAPI().getStorage().remove(entity);
                    super.getSession().getSessionSearch().getFiltersAPI().getStorage().add({
                        request: entity.asDesc().request,
                        flags: {
                            casesensitive: true,
                            wholeword: true,
                            regexp: true,
                        }
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

    public async search(entity: Entity<FilterRequest>) {
        await this._setSearchActive().catch((error: Error) => {
            this._logger.error(`Failed to show matches due to error: ${error.message}`);
        });
        super.getSession().getSessionSearch().search(entity.getEntity());
    }

    public actions(target: Entity<any>, selected: Array<Entity<any>>): {
        activate?: () => void,
        deactivate?: () => void,
        remove?: () => void,
        edit?: () => void,
    } {
        const actions: {
            activate?: () => void,
            deactivate?: () => void,
            remove?: () => void,
            edit?: () => void
        } = {};
        const self = this;
        const entities = selected.filter((entity: Entity<any>) => {
            return entity.getEntity() instanceof FilterRequest;
        });
        actions.activate = entities.filter((entity: Entity<FilterRequest>) => {
            return entity.getEntity().getState() === false;
        }).length !== 0 ? () => {
            entities.forEach((entity: Entity<FilterRequest>) => {
                entity.getEntity().setState(true);
            });
        } : undefined;
        actions.deactivate = entities.filter((entity: Entity<FilterRequest>) => {
            return entity.getEntity().getState() === true;
        }).length !== 0 ? () => {
            entities.forEach((entity: Entity<FilterRequest>) => {
                entity.getEntity().setState(false);
            });
        } : undefined;
        actions.edit = (selected.length === 1 && entities.length === 1) ? () => {
            // View should be focused to switch to edit-mode, but while context
            // menu is open, there are no focus. Well, that's why settimer here.
            setTimeout(() => {
                self.edit().in();
            });
        } : undefined;
        actions.remove = entities.length !== 0 ? () => {
            if (entities.length === self.get().length) {
                self.getSession().getSessionSearch().getFiltersAPI().getStorage().clear();
                self.update();
            } else {
                entities.forEach((entity: Entity<FilterRequest>) => {
                    self.getSession().getSessionSearch().getFiltersAPI().getStorage().remove(entity.getEntity());
                });
            }
        } : undefined;
        return actions;
    }

    private _setSearchActive(): Promise<boolean> {
        return new Promise((resolve) => {
            resolve(ToolbarSessionsService.setActive(ToolbarSessionsService.getDefaultsGuids().search));
        });
    }

}
