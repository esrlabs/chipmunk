import { Entity } from '../providers/entity';
import { Provider } from '../providers/provider';
import { ChartRequest, IChartsStorageUpdated,  } from '../../../../controller/controller.session.tab.search.charts.storage';
import { FilterRequest } from '../../../../controller/controller.session.tab.search.filters';
import { IComponentDesc } from 'chipmunk-client-material';
import { ControllerSessionTab } from '../../../../controller/controller.session.tab';
import { Subject, Observable, Subscription } from 'rxjs';
import { SidebarAppSearchManagerChartsComponent } from './list/component';
import { SidebarAppSearchManagerChartDetailsComponent } from './details/component';
import { IMenuItem } from '../../../../services/standalone/service.contextmenu';
import { EChartType } from '../../../../components/views/chart/charts/charts';

export class ProviderCharts extends Provider<ChartRequest> {

    private _subs: { [key: string]: Subscription } = {};
    private _entities: Map<string, Entity<ChartRequest>> = new Map();

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
        this._subs.updated = session.getSessionSearch().getChartsAPI().getStorage().getObservable().updated.subscribe((event?: IChartsStorageUpdated) => {
            super.update();
            if (event === undefined || !(event.added instanceof ChartRequest)) {
                // this._selectFilter(event.added); // SELECT
            }
        });
    }

    public get(): Array<Entity<ChartRequest>> {
        const guids: string[] = [];
        const entities = super.getSession() === undefined ? [] : super.getSession().getSessionSearch().getChartsAPI().getStorage().get().map((chart: ChartRequest) => {
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

    public reorder(params: {
        prev: number,
        curt: number,
    }) {
        if (super.getSession() === undefined) {
            return;
        }
        super.getSession().getSessionSearch().getChartsAPI().getStorage().reorder(params);
        super.update();
    }

    public getContentIfEmpty(): string | undefined {
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
        if (selected.length !== 1) {
            return [];
        }
        const entity: FilterRequest = selected[0].getEntity();
        const items: IMenuItem[] = [];
        if (entity instanceof FilterRequest && ChartRequest.isValid(entity.asDesc().request)) {
            items.push({
                caption: `Conver To Chart`,
                handler: () => {
                    super.getSession().getSessionSearch().getFiltersAPI().getStorage().remove(entity);
                    super.getSession().getSessionSearch().getChartsAPI().getStorage().add({
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
                    super.getSession().getSessionSearch().search(new FilterRequest({
                        request: (entity as ChartRequest).asDesc().request,
                        flags: {
                            casesensitive: false,
                            wholeword: false,
                            regexp: true,
                        }
                    }));
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
                    if (entity.getEntity() instanceof ChartRequest) {
                        (entity.getEntity() as ChartRequest).setState(true);
                    }
                });
            },
            deactivate: () => {
                selected.forEach((entity: Entity<any>) => {
                    if (entity.getEntity() instanceof ChartRequest) {
                        (entity.getEntity() as ChartRequest).setState(false);
                    }
                });
            },
            remove: () => {
                const entities = selected.filter((entity: Entity<any>) => {
                    return entity.getEntity() instanceof ChartRequest;
                });
                if (entities.length === this.get().length) {
                    super.getSession().getSessionSearch().getChartsAPI().getStorage().clear();
                    super.update();
                } else {
                    entities.forEach((entity: Entity<ChartRequest>) => {
                        super.getSession().getSessionSearch().getChartsAPI().getStorage().remove(entity.getEntity());
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
