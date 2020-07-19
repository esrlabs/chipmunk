import { Entity } from '../providers/entity';
import { Provider } from '../providers/provider';
import { ChartRequest, IChartsStorageUpdated } from '../../../../controller/controller.session.tab.search.charts.storage';
import { IComponentDesc } from 'chipmunk-client-material';
import { ControllerSessionTab } from '../../../../controller/controller.session.tab';
import { Subject, Observable, Subscription } from 'rxjs';
import { SidebarAppSearchManagerChartsComponent } from './list/component';
import { SidebarAppSearchManagerChartDetailsComponent } from './details/component';

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
        if (this.getSelection().length !== 1) {
            return '';
        }
        const selection = this._entities.get(this.getSelection()[0]);
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

}
