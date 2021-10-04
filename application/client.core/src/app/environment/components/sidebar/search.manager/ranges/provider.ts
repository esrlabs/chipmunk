import { Entity } from '../providers/entity';
import { Provider } from '../providers/provider';
import { FilterRequest } from '../../../../controller/session/dependencies/search/dependencies/filters/controller.session.tab.search.filters.storage';
import { RangeRequest } from '../../../../controller/session/dependencies/search/dependencies/timeranges/controller.session.tab.search.ranges.request';
import { DisabledRequest } from '../../../../controller/session/dependencies/search/dependencies/disabled/controller.session.tab.search.disabled';
import { IRangesStorageUpdated } from '../../../../controller/session/dependencies/search/dependencies/timeranges/controller.session.tab.search.ranges.storage';
import { IComponentDesc } from 'chipmunk-client-material';
import { Session } from '../../../../controller/session/session';
import { Subscription } from 'rxjs';
import { SidebarAppSearchManagerTimeRangesComponent } from './list/component';
import { SidebarAppSearchManagerTimerangeDetailsComponent } from './details/component';
import { IMenuItem } from '../../../../services/standalone/service.contextmenu';
import { CancelablePromise } from 'chipmunk.client.toolkit';
import { CdkDragDrop } from '@angular/cdk/drag-drop';
import { EntityData } from '../providers/entity.data';

import * as Toolkit from 'chipmunk.client.toolkit';
import SearchManagerService, { TRequest, EListID } from '../service/service';

export class ProviderRanges extends Provider<RangeRequest> {
    private _subs: { [key: string]: Subscription } = {};
    private _entities: Map<string, Entity<RangeRequest>> = new Map();
    private _listID: EListID = EListID.rangesList;

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
            .getRangesAPI()
            .getStorage()
            .getObservable()
            .updated.subscribe((event?: IRangesStorageUpdated) => {
                super.change();
                if (event === undefined) {
                    return;
                }
                if (event.added instanceof RangeRequest) {
                    this.select().set({ guid: event.added.getGUID() });
                }
                if (event.removed instanceof RangeRequest || event.ranges.length === 0) {
                    this.select().drop();
                }
            });
    }

    public get(): Array<Entity<RangeRequest>> {
        const guids: string[] = [];
        const session = super.getSession();
        const entities =
            session === undefined
                ? []
                : session
                      .getSessionSearch()
                      .getRangesAPI()
                      .getStorage()
                      .get()
                      .map((filter: RangeRequest) => {
                          let entity = this._entities.get(filter.getGUID());
                          if (entity === undefined) {
                              entity = new Entity<RangeRequest>(filter, filter.getGUID());
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
        session.getSessionSearch().getRangesAPI().getStorage().reorder(params);
        super.change();
    }

    public getContentIfEmpty(): undefined {
        return undefined;
    }

    public getPanelName(): string {
        return `Time Ranges`;
    }

    public getPanelDesc(): string {
        const count = this.get().length;
        return `${count} range${count > 1 ? 's' : ''}`;
    }

    public getDetailsPanelName(): string {
        return `Time Range Details`;
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

    public getContextMenuItems(target: Entity<any>, selected: Array<Entity<any>>): IMenuItem[] {
        const items: IMenuItem[] = [];
        const filters: Entity<FilterRequest>[] = selected.filter(
            (entity) => entity.getEntity() instanceof FilterRequest,
        );
        const ranges: Entity<RangeRequest>[] = selected.filter(
            (entity) => entity.getEntity() instanceof RangeRequest,
        );
        const session = super.getSession();
        if (session === undefined) {
            return [];
        }
        if (selected.length >= 2 && filters.length >= 2 && filters.length === selected.length) {
            items.push({
                caption: `Create Time Range`,
                handler: () => {
                    session
                        .getSessionSearch()
                        .getRangesAPI()
                        .getStorage()
                        .add(
                            new RangeRequest({
                                points: selected.map((_) => _.getEntity()),
                                alias: `Time range #${
                                    session.getSessionSearch().getRangesAPI().getStorage().get()
                                        .length + 1
                                }`,
                            }),
                        );
                },
            });
        }
        if (ranges.length > 0) {
            items.push({
                caption: `Remove bars from chart`,
                handler: () => {
                    ranges.forEach((entity: Entity<RangeRequest>) => {
                        session.getTimestamp().removeRange(entity.getEntity().getGUID());
                    });
                },
            });
        }
        return items;
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
        const entities = selected.filter((entity: Entity<any>) => {
            return entity.getEntity() instanceof RangeRequest;
        });
        const session = super.getSession();
        if (session === undefined) {
            return {};
        }
        return {
            remove:
                entities.length !== 0
                    ? () => {
                          if (entities.length === self.get().length) {
                              session.getSessionSearch().getRangesAPI().getStorage().clear();
                              self.change();
                          } else {
                              entities.forEach((entity: Entity<RangeRequest>) => {
                                  session
                                      .getSessionSearch()
                                      .getRangesAPI()
                                      .getStorage()
                                      .remove(entity.getEntity());
                              });
                          }
                          // Remove ranges
                          entities.forEach((entity: Entity<RangeRequest>) => {
                              session.getTimestamp().removeRange(entity.getEntity().getGUID());
                          });
                      }
                    : undefined,
        };
    }

    public search(entity: Entity<RangeRequest>) {
        // NOTE Implement abstract method no usage for ranges yet
        return;
    }

    public apply(): Promise<void> {
        return new Promise((resolve, reject) => {
            let entities = this.select().getEntities();
            entities = entities.length === 0 ? Array.from(this._entities.values()) : entities;
            if (entities.length === 0) {
                return resolve();
            }
            const session = super.getSession();
            if (session === undefined) {
                return reject(new Error(`No session has been found`));
            }
            const errors: Error[] = [];
            const stack: Map<string, CancelablePromise<any>> = new Map();
            entities.forEach((entity) => {
                const task: CancelablePromise<any> | Error = session
                    .getSessionSearch()
                    .getRangesAPI()
                    .search(entity.getEntity());
                const id = Toolkit.guid();
                if (task instanceof Error) {
                    errors.push(task);
                } else {
                    stack.set(id, task);
                    task.catch((err: Error) => {
                        errors.push(err);
                    }).finally(() => {
                        stack.delete(id);
                        if (stack.size === 0) {
                            if (errors.length > 0) {
                                reject(new Error(errors.map((e) => e.message).join('\n')));
                            } else {
                                resolve();
                            }
                        }
                    });
                }
            });
            if (stack.size === 0 && errors.length > 0) {
                reject(new Error(errors.map((e) => e.message).join('\n')));
            }
        });
    }

    public isViable(): boolean {
        const dragging: Entity<TRequest> | undefined = SearchManagerService.dragging;
        if (dragging) {
            const request = dragging.getEntity();
            if (request instanceof DisabledRequest) {
                if ((request as DisabledRequest).getEntity() instanceof RangeRequest) {
                    return true;
                }
                return false;
            } else if (request instanceof RangeRequest) {
                return true;
            }
        }
        return false;
    }

    public itemDragged(event: CdkDragDrop<EntityData<TRequest>>) {
        if (event.previousContainer === event.container) {
            this.reorder({ prev: event.previousIndex, curt: event.currentIndex });
        } else {
            const session = super.getSession();
            if (session === undefined) {
                return;
            }
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
                    outside.getEntity().getEntity() instanceof RangeRequest
                ) {
                    session
                        .getSessionSearch()
                        .getDisabledAPI()
                        .getStorage()
                        .remove(outside.getEntity());
                    session
                        .getSessionSearch()
                        .getRangesAPI()
                        .getStorage()
                        .add(outside.getEntity().getEntity() as RangeRequest, event.currentIndex);
                }
            }
        }
    }

    public get listID(): EListID {
        return this._listID;
    }
}
