import { Entity } from '../providers/entity';
import { Provider } from '../providers/provider';
import {
    DisabledRequest,
    IUpdateEvent,
} from '../../../../controller/session/dependencies/search/dependencies/disabled/controller.session.tab.search.disabled.storage';
import { IComponentDesc } from 'chipmunk-client-material';
import { Session } from '../../../../controller/session/session';
import { Subscription } from 'rxjs';
import { SidebarAppSearchManagerDisabledsComponent } from './list/component';
import { IMenuItem } from '../../../../services/standalone/service.contextmenu';
import { IDisabledEntitySupport } from 'src/app/environment/controller/session/dependencies/search/dependencies/disabled/controller.session.tab.search.disabled.support';
import { Logger } from 'chipmunk.client.toolkit';
import { FilterRequest } from '../../../../controller/session/dependencies/search/dependencies/filters/controller.session.tab.search.filters.request';
import { ChartRequest } from '../../../../controller/session/dependencies/search/dependencies/charts/controller.session.tab.search.charts.request';
import { CdkDragDrop } from '@angular/cdk/drag-drop';
import { TRequest, EListID } from '../service/service';
import { EntityData } from '../providers/entity.data';

export class ProviderDisabled extends Provider<DisabledRequest> {
    private _subs: { [key: string]: Subscription } = {};
    private _entities: Map<string, Entity<DisabledRequest>> = new Map();
    private _logger: Logger = new Logger('ProviderDisabled');
    private _listID: EListID = EListID.disabledList;

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
            .getDisabledAPI()
            .getStorage()
            .getObservable()
            .updated.subscribe((event?: IUpdateEvent) => {
                super.change();
                if (event === undefined) {
                    return;
                }
                if (event.added instanceof DisabledRequest) {
                    this.select().set({
                        guid: event.added.getGUID(),
                        sender: undefined,
                        ignore: true,
                    });
                }
                if (event.removed instanceof DisabledRequest || event.requests.length === 0) {
                    this.select().drop();
                }
            });
    }

    public get(): Array<Entity<DisabledRequest>> {
        const guids: string[] = [];
        const session = super.getSession();
        const entities =
            session === undefined
                ? []
                : session
                      .getSessionSearch()
                      .getDisabledAPI()
                      .getStorage()
                      .get()
                      .map((item: DisabledRequest) => {
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

    public reorder(params: { prev: number; curt: number }) {
        const session = super.getSession();
        if (session === undefined) {
            return;
        }
        session.getSessionSearch().getDisabledAPI().getStorage().reorder(params);
        super.change();
    }

    public getContentIfEmpty(): undefined {
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
        const entities: IDisabledEntitySupport[] = selected
            .filter((entity: Entity<any>) => {
                return !(entity.getEntity() instanceof DisabledRequest);
            })
            .map((entity: Entity<any>) => {
                return entity.getEntity();
            });
        const disableds: DisabledRequest[] = selected
            .filter((entity: Entity<any>) => {
                return entity.getEntity() instanceof DisabledRequest;
            })
            .map((entity: Entity<any>) => {
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
                    session
                        .getSessionSearch()
                        .getDisabledAPI()
                        .getStorage()
                        .add(
                            entities.map((entity: IDisabledEntitySupport) => {
                                entity.remove(session);
                                return new DisabledRequest(entity);
                            }),
                        );
                },
            });
        }
        if (entities.length === 0 && disableds.length > 0) {
            items.push({
                caption: `Enable`,
                handler: () => {
                    disableds.forEach((disabled: DisabledRequest) => {
                        disabled.getEntity().restore(session);
                        session.getSessionSearch().getDisabledAPI().getStorage().remove(disabled);
                    });
                },
            });
        }
        if (match !== undefined) {
            const entry = match.getEntity();
            items.push({
                caption: `Show Matches`,
                handler: () => {
                    super.openSearchToolbarApp().catch((error: Error) => {
                        this._logger.error(error.message);
                    });
                    entry.matches !== undefined && entry.matches(session);
                },
            });
        }
        return items;
    }

    public search(entity: Entity<any>) {
        const cEntity = entity.getEntity().getEntity();
        const session = this.getSession();
        if (session === undefined) {
            return;
        }
        super
            .openSearchToolbarApp()
            .then(() => {
                if (cEntity instanceof ChartRequest) {
                    session.getSessionSearch().search(
                        new FilterRequest({
                            request: (cEntity as ChartRequest).asDesc().request,
                            flags: {
                                casesensitive: false,
                                wholeword: false,
                                regexp: true,
                            },
                        }),
                    );
                } else if (cEntity instanceof FilterRequest) {
                    session.getSessionSearch().search(cEntity);
                }
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
        const self = this;
        const disableds: DisabledRequest[] = selected
            .filter((entity: Entity<any>) => {
                return entity.getEntity() instanceof DisabledRequest;
            })
            .map((entity: Entity<any>) => {
                return entity.getEntity();
            });
        const session = this.getSession();
        if (session === undefined) {
            return {};
        }
        return {
            remove:
                disableds.length !== 0
                    ? () => {
                          disableds.forEach((disabled: DisabledRequest) => {
                              session
                                  .getSessionSearch()
                                  .getDisabledAPI()
                                  .getStorage()
                                  .remove(disabled);
                          });
                      }
                    : undefined,
        };
    }

    // Method because of abstract class, not used
    public isViable() {
        return true;
    }

    public itemDragged(event: CdkDragDrop<EntityData<TRequest>>) {
        if (event.previousContainer === event.container) {
            this.reorder({ prev: event.previousIndex, curt: event.currentIndex });
        } else {
            const index: number = event.previousIndex;
            const data: EntityData<TRequest> = event.previousContainer.data;
            if (data.entries !== undefined) {
                const outside: Entity<TRequest> | undefined =
                    data.entries[event.previousIndex] !== undefined
                        ? data.entries[index]
                        : undefined;
                if (outside !== undefined) {
                    const session = this.getSession();
                    if (session === undefined) {
                        return;
                    }
                    session
                        .getSessionSearch()
                        .getDisabledAPI()
                        .getStorage()
                        .add(
                            new DisabledRequest(
                                outside.getEntity() as unknown as IDisabledEntitySupport,
                            ),
                            event.currentIndex,
                        );
                    outside.getEntity().remove(session);
                }
            }
        }
    }

    public get listID(): EListID {
        return this._listID;
    }
}
