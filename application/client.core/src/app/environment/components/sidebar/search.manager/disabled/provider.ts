import { Entity } from '../providers/entity';
import { Provider } from '../providers/provider';
import { DisabledRequest, IUpdateEvent } from '../../../../controller/controller.session.tab.search.disabled.storage';
import { IComponentDesc } from 'chipmunk-client-material';
import { ControllerSessionTab } from '../../../../controller/controller.session.tab';
import { Subject, Observable, Subscription } from 'rxjs';
import { SidebarAppSearchManagerDisabledsComponent } from './list/component';
import { IMenuItem } from '../../../../services/standalone/service.contextmenu';
import { IDisabledEntitySupport } from 'src/app/environment/controller/controller.session.tab.search.disabled.support';
import ToolbarSessionsService from '../../../../services/service.sessions.toolbar';
import { Logger } from 'chipmunk.client.toolkit';
import { FilterRequest } from '../../../../controller/controller.session.tab.search.filters.request';
import { ChartRequest } from '../../../../controller/controller.session.tab.search.charts.request';

export class ProviderDisabled extends Provider<DisabledRequest> {

    private _subs: { [key: string]: Subscription } = {};
    private _entities: Map<string, Entity<DisabledRequest>> = new Map();
    private _logger: Logger = new Logger('ProviderDisabled');

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
        this._subs.updated = session.getSessionSearch().getDisabledAPI().getStorage().getObservable().updated.subscribe((event?: IUpdateEvent) => {
            super.update();
            if (event === undefined) {
                return;
            }
            if (event.added instanceof DisabledRequest) {
                this.select().set({
                    guid: event.added.getGUID(),
                    sender: undefined,
                    ignore: true
                });
            }
            if (event.removed instanceof DisabledRequest || event.requests.length === 0) {
                this.select().drop();
            }
        });
    }

    public get(): Array<Entity<DisabledRequest>> {
        const guids: string[] = [];
        const entities = super.getSession() === undefined ? [] : super.getSession().getSessionSearch().getDisabledAPI().getStorage().get().map((item: DisabledRequest) => {
            let entity = this._entities.get(item.getGUID());
            if (entity === undefined) {
                entity = new Entity<DisabledRequest>(item, item.getGUID());
            } else {
                entity.setEntity(item);
            }
            this._entities.set(item.getGUID(), entity);
            guids.push(item.getGUID());
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
        super.getSession().getSessionSearch().getDisabledAPI().getStorage().reorder(params);
        super.update();
    }

    public getContentIfEmpty(): string | undefined {
        return undefined;
    }

    public getPanelName(): string {
        return `Disabled`;
    }

    public getPanelDesc(): string {
        const count = this.get().length;
        return `${count} ${count > 1 ? 'entities' : 'entity'}`;
    }

    public getDetailsPanelName(): string | undefined {
        return undefined;
    }

    public getDetailsPanelDesc(): string | undefined {
        return undefined;
    }

    public getListComp(): IComponentDesc {
        return {
            factory: SidebarAppSearchManagerDisabledsComponent,
            inputs: {
                provider: this,
            },
        };
    }

    public getDetailsComp(): IComponentDesc | undefined {
        return undefined;
    }

    public getContextMenuItems(target: Entity<any>, selected: Array<Entity<any>>): IMenuItem[] {
        const session = this.getSession();
        if (session === undefined) {
            return [];
        }
        const entities: IDisabledEntitySupport[] = selected.filter((entity: Entity<any>) => {
            return !(entity.getEntity() instanceof DisabledRequest);
        }).map((entity: Entity<any>) => {
            return entity.getEntity();
        });
        const disableds: DisabledRequest[] = selected.filter((entity: Entity<any>) => {
            return entity.getEntity() instanceof DisabledRequest;
        }).map((entity: Entity<any>) => {
            return entity.getEntity();
        });
        const match = disableds.find((entity) => {
            return entity.getEntity().matches !== undefined;
        });
        const items: IMenuItem[] = [];
        if (entities.length > 0 && disableds.length === 0) {
            items.push({
                caption: `Disable`,
                handler: () => {
                    this.getSession().getSessionSearch().getDisabledAPI().getStorage().add(entities.map((entity: IDisabledEntitySupport) => {
                        entity.remove(session);
                        return new DisabledRequest(entity);
                    }));
                },
            });
        }
        if (entities.length === 0 && disableds.length > 0) {
            items.push({
                caption: `Enable`,
                handler: () => {
                    disableds.forEach((disabled: DisabledRequest) => {
                        disabled.getEntity().restore(session);
                        this.getSession().getSessionSearch().getDisabledAPI().getStorage().remove(disabled);
                    });
                },
            });
        }
        if (match !== undefined) {
            items.push({
                caption: `Show Matches`,
                handler: () => {
                    ToolbarSessionsService.setActive(ToolbarSessionsService.getDefaultsGuids().search).catch((error: Error) => {
                        this._logger.error(error.message);
                    });
                    match.getEntity().matches(session);
                },
            });
        }
        return items;
    }

    public search(entity: Entity<any>) {
        ToolbarSessionsService.setActive(ToolbarSessionsService.getDefaultsGuids().search).then(() => {
            if (entity.getEntity().entity instanceof ChartRequest) {
                super.getSession().getSessionSearch().search(new FilterRequest({
                    request: (entity.getEntity().entity as ChartRequest).asDesc().request,
                    flags: {
                        casesensitive: false,
                        wholeword: false,
                        regexp: true,
                    }
                }));
            } else if (entity.getEntity().entity instanceof FilterRequest) {
                super.getSession().getSessionSearch().search(entity.getEntity().entity);
            }
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
        const self = this;
        const disableds: DisabledRequest[] = selected.filter((entity: Entity<any>) => {
            return entity.getEntity() instanceof DisabledRequest;
        }).map((entity: Entity<any>) => {
            return entity.getEntity();
        });
        return {
            remove: disableds.length !== 0 ? () => {
                disableds.forEach((disabled: DisabledRequest) => {
                    self.getSession().getSessionSearch().getDisabledAPI().getStorage().remove(disabled);
                });
            } : undefined,
        };
    }

}
