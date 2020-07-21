import { Entity } from '../providers/entity';
import { Provider } from '../providers/provider';
import { TimeRange } from '../../../../controller/controller.session.tab.timestamps.range';
import { IComponentDesc } from 'chipmunk-client-material';
import { ControllerSessionTab } from '../../../../controller/controller.session.tab';
import { Subject, Observable, Subscription } from 'rxjs';
import { SidebarAppSearchManagerTimeRangesComponent } from './list/component';
import { SidebarAppSearchManagerTimerangeDetailsComponent } from './details/component';
import { IMenuItem } from '../../../../services/standalone/service.contextmenu';

export class ProviderRanges extends Provider<TimeRange> {

    private _subs: { [key: string]: Subscription } = {};
    private _entities: Map<string, Entity<TimeRange>> = new Map();

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
        /*
        this._subs.updated = session.getSessionSearch().getFiltersAPI().getStorage().getObservable().updated.subscribe((event?: IFiltersStorageUpdated) => {
            super.update();
            if (event === undefined || !(event.added instanceof TimeRange)) {
                // this._selectFilter(event.added); // SELECT
            }
        });
        */
    }

    public get(): Array<Entity<TimeRange>> {
        return [];
        /*
        const guids: string[] = [];
        const entities = super.getSession() === undefined ? [] : super.getSession().getSessionSearch().getFiltersAPI().getStorage().get().map((filter: TimeRange) => {
            let entity = this._entities.get(filter.getGUID());
            if (entity === undefined) {
                entity = new Entity<TimeRange>(filter, filter.getGUID());
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
        */
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
        return '';
    }

    public getListComp(): IComponentDesc {
        return {
            factory: SidebarAppSearchManagerTimeRangesComponent,
            inputs: {
                provider: this,
            },
        };
    }

    public getDetailsComp(): IComponentDesc {
        return {
            factory: SidebarAppSearchManagerTimerangeDetailsComponent,
            inputs: {
                provider: this,
            },
        };
    }

    /*

    */
    public getContextMenuItems(target: Entity<any>, selected: Array<Entity<any>>): IMenuItem[] {
        return [];
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
            activate: () => {},
            deactivate: () => {},
            remove: () => {},
            edit: () => {}
        };
    }

}
