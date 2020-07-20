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

export class ProviderFilters extends Provider<FilterRequest> {

    private _subs: { [key: string]: Subscription } = {};
    private _entities: Map<string, Entity<FilterRequest>> = new Map();

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
            if (event === undefined || !(event.added instanceof FilterRequest)) {
                // this._selectFilter(event.added); // SELECT
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

    /*

    */
    public getContextMenuItems(target: Entity<any>, selected: Array<Entity<any>>): IMenuItem[] {
        if (selected.length !== 1) {
            return [];
        }
        const entity: ChartRequest = selected[0].getEntity();
        const items: IMenuItem[] = [];
        if (entity instanceof ChartRequest && FilterRequest.isValid(entity.asDesc().request)) {
            items.push({
                caption: `Conver To Filter`,
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
                    super.getSession().getSessionSearch().search(entity);
                },
            });
        }
        return items;
    }

    public actions(target: Entity<any>, selected: Array<Entity<any>>): {
        enable?: () => void,
        disable?: () => void,
        activate?: () => void,
        deactivate?: () => void,
        remove?: () => void,
        edit?: () => void,
    } {
        return {
            enable: () => {},
            disable: () => {},
            activate: () => {
                selected.forEach((entity: Entity<any>) => {
                    if (entity.getEntity() instanceof FilterRequest) {
                        (entity.getEntity() as FilterRequest).setState(true);
                    }
                });
            },
            deactivate: () => {
                selected.forEach((entity: Entity<any>) => {
                    if (entity.getEntity() instanceof FilterRequest) {
                        (entity.getEntity() as FilterRequest).setState(false);
                    }
                });
            },
            remove: () => {
                const entities = selected.filter((entity: Entity<any>) => {
                    return entity.getEntity() instanceof FilterRequest;
                });
                if (entities.length === this.get().length) {
                    super.getSession().getSessionSearch().getFiltersAPI().getStorage().clear();
                    super.update();
                } else {
                    entities.forEach((entity: Entity<FilterRequest>) => {
                        super.getSession().getSessionSearch().getFiltersAPI().getStorage().remove(entity.getEntity());
                    });
                }
            },
            edit: () => {
                if (selected.length !== 1) {
                    return;
                }
                // View should be focused to switch to edit-mode, but while context
                // menu is open, there are no focus. Well, that's why settimer here.
                setTimeout(() => {
                    this.edit().in();
                });
            }
        };
    }

}
