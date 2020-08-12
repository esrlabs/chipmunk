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
import ToolbarSessionsService from '../../../../services/service.sessions.toolbar';
import { Logger } from 'chipmunk.client.toolkit';

export class ProviderCharts extends Provider<ChartRequest> {

    private _subs: { [key: string]: Subscription } = {};
    private _entities: Map<string, Entity<ChartRequest>> = new Map();
    private _logger: Logger = new Logger('ProviderCharts');

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
            if (event === undefined) {
                return;
            }
            if (event.added instanceof ChartRequest) {
                this.select().set({
                    guid: event.added.getGUID(),
                    sender: undefined,
                    ignore: true
                });
            }
            if (event.removed instanceof ChartRequest || event.requests.length === 0) {
                this.select().drop();
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
                caption: `Convert To Chart`,
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
                    this.search(selected[0]);
                },
            });
        }
        return items;
    }

    public search(entity: Entity<ChartRequest>) {
        ToolbarSessionsService.setActive(ToolbarSessionsService.getDefaultsGuids().search).then(() => {
            super.getSession().getSessionSearch().search(new FilterRequest({
                request: (entity.getEntity() as ChartRequest).asDesc().request,
                flags: {
                    casesensitive: false,
                    wholeword: false,
                    regexp: true,
                }
            }));
        }).catch((error: Error) => {
            this._logger.error(`Failed to show matches due to error: ${error.message}`);
        });
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
            return entity.getEntity() instanceof ChartRequest;
        });
        actions.activate = entities.filter((entity: Entity<ChartRequest>) => {
            return entity.getEntity().getState() === false;
        }).length !== 0 ? () => {
            entities.forEach((entity: Entity<ChartRequest>) => {
                entity.getEntity().setState(true);
            });
        } : undefined;
        actions.deactivate = entities.filter((entity: Entity<ChartRequest>) => {
            return entity.getEntity().getState() === true;
        }).length !== 0 ? () => {
            entities.forEach((entity: Entity<ChartRequest>) => {
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
                self.getSession().getSessionSearch().getChartsAPI().getStorage().clear();
                self.update();
            } else {
                entities.forEach((entity: Entity<ChartRequest>) => {
                    self.getSession().getSessionSearch().getChartsAPI().getStorage().remove(entity.getEntity());
                });
            }
        } : undefined;
        return actions;
    }

}
