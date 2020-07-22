import { Subject, Observable, Subscription } from 'rxjs';
import { Entity } from './entity';
import { ControllerSessionTab } from '../../../../controller/controller.session.tab';
import { IComponentDesc } from 'chipmunk-client-material';
import { KeyboardListener } from './keyboard.listener';
import { IMenuItem } from '../../../../services/standalone/service.contextmenu';

import EventsSessionService from '../../../../services/standalone/service.events.session';
import TabsSessionsService from '../../../../services/service.sessions.tabs';

import * as Toolkit from 'chipmunk.client.toolkit';

export enum EProviders {
    filters = 'filters',
    charts = 'charts',
    ranges = 'ranges',
}

export interface ISelectEvent {
    provider: Provider<any>;
    guids: string[];
    sender?: string;
}

export interface IContextMenuEvent {
    event: MouseEvent;
    provider: Provider<any>;
    entity: Entity<any>;
    items?: IMenuItem[];
}

export enum EActions {
    enable = 'enable',
    disable = 'disable',
    remove = 'remove',
    activate = 'activate',
    deactivate = 'deactivate',
    edit = 'edit',
}

export abstract class Provider<T> {

    private _subjects: {
        change: Subject<void>,
        selection: Subject<ISelectEvent>,
        edit: Subject<string | undefined>,
        context: Subject<IContextMenuEvent>,
    } = {
        change: new Subject(),
        selection: new Subject(),
        edit: new Subject(),
        context: new Subject(),
    };
    private _session: ControllerSessionTab | undefined;
    private _selection: string[] = [];
    private _keyboard: KeyboardListener;
    private _subscriptions: { [key: string]: Subscription } = {};
    private _guid: string = Toolkit.guid();

    constructor() {
        this._session = TabsSessionsService.getActive();
        this._subscriptions.onSessionChange = EventsSessionService.getObservable().onSessionChange.subscribe(this._onSessionChange.bind(this));
    }

    public destroy() {
        this.unsubscribe();
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
        });
    }

    public getGuid(): string {
        return this._guid;
    }

    public setKeyboardListener(listener: KeyboardListener) {
        this._keyboard = listener;
    }

    public select(): {
        first: () => void,
        last: () => void,
        next: () => boolean,
        prev: () => boolean,
        drop: (sender?: string) => void,
        get: () => string[],
        getEntities: () => Array<Entity<T>>,
        set: (guid: string, sender?: string) => void,
        single: () => Entity<T> | undefined,
        context: (event: MouseEvent, entity: Entity<T>) => void,
    } {
        const setSelection: (guid: string, sender?: string) => void = (guid: string, sender?: string) => {
            const index: number = this._selection.indexOf(guid);
            if (this._keyboard.ctrl()) {
                if (index === -1) {
                    this._selection.push(guid);
                } else {
                    this._selection.splice(index, 1);
                }
            } else {
                if (index === -1) {
                    this._selection = [guid];
                } else {
                    this._selection = [];
                }
            }
            this._subjects.selection.next({
                provider: this,
                guids: this._selection,
                sender: sender,
            });
        };
        return {
            first: () => {
                const entities = this.get();
                if (entities.length === 0) {
                    return;
                }
                setSelection(entities[0].getGUID(), 'self.fisrt');
            },
            last: () => {
                const entities = this.get();
                if (entities.length === 0) {
                    return;
                }
                setSelection(entities[entities.length - 1].getGUID(), 'self.last');
            },
            next: () => {
                if (this._selection.length !== 1) {
                    return false;
                }
                const entities = this.get();
                let index: number = -1;
                entities.forEach((entity, i) => {
                    if (entity.getGUID() === this._selection[0]) {
                        index = i;
                    }
                });
                if (index === -1) {
                    return false;
                }
                if (index + 1 > entities.length - 1) {
                    return false;
                }
                setSelection(entities[index + 1].getGUID(), 'self.next');
                return true;
            },
            prev: () => {
                if (this._selection.length !== 1) {
                    return false;
                }
                const entities = this.get();
                let index: number = -1;
                entities.forEach((entity, i) => {
                    if (entity.getGUID() === this._selection[0]) {
                        index = i;
                    }
                });
                if (index === -1) {
                    return false;
                }
                if (index - 1 < 0) {
                    return false;
                }
                setSelection(entities[index - 1].getGUID(), 'self.next');
                return true;
            },
            drop: (sender?: string) => {
                if (this._selection.length === 0) {
                    return;
                }
                this._selection = [];
                this._subjects.selection.next({
                    provider: this,
                    guids: this._selection,
                    sender: sender,
                });
            },
            get: () => {
                return this._selection.slice();
            },
            getEntities: () => {
                const entities = [];
                this.get().forEach((entity: Entity<T>) => {
                    if (this._selection.indexOf(entity.getGUID()) === -1) {
                        return;
                    }
                    entities.push(entity);
                });
                return entities;
            },
            set: setSelection,
            single: () => {
                if (this._selection.length !== 1) {
                    return undefined;
                }
                return this.get().find((entity: Entity<T>) => {
                    return entity.getGUID() === this._selection[0];
                });
            },
            context: (event: MouseEvent, entity: Entity<T>) => {
                this._subjects.context.next({
                    event: event,
                    entity: entity,
                    provider: this,
                });
            },
        };
    }

    public edit(): {
        in: () => void,
        out: () => void,
    } {
        return {
            in: () => {
                if (this._selection.length !== 1) {
                    return;
                }
                const guid: string = this._selection[0];
                this.get().forEach((entity: Entity<any>) => {
                    if (entity.getGUID() === guid) {
                        entity.getEditState().in();
                    } else {
                        entity.getEditState().out();
                    }
                });
                this._subjects.edit.next(guid);
            },
            out: () => {
                this.get().forEach((entity: Entity<any>) => {
                    entity.getEditState().out();
                });
                this._subjects.edit.next(undefined);
            },
        };
    }

    public getObservable(): {
        change: Observable<void>,
        selection: Observable<ISelectEvent>,
        edit: Observable<string | undefined>,
        context: Observable<IContextMenuEvent>,
    } {
        return {
            change: this._subjects.change.asObservable(),
            selection: this._subjects.selection.asObservable(),
            edit: this._subjects.edit.asObservable(),
            context: this._subjects.context.asObservable(),
        };
    }

    public update() {
        this._subjects.change.next();
    }

    public getSession(): ControllerSessionTab | undefined {
        return this._session;
    }

    public isEmpty(): boolean {
        return this.get().length === 0;
    }

    public abstract unsubscribe();

    public abstract get(): Entity<T>[];

    public abstract reorder(params: {
        prev: number,
        curt: number,
    }): void;

    public abstract getPanelName(): string;

    public abstract getPanelDesc(): string;

    public abstract getDetailsPanelName(): string;

    public abstract getDetailsPanelDesc(): string;

    public abstract getListComp(): IComponentDesc;

    public abstract getDetailsComp(): IComponentDesc;

    /**
     * Should called in inherit class in constructor
     * @param session
     */
    public abstract setSessionController(session: ControllerSessionTab | undefined);

    /**
     * Should return undefined to hide panel in case of empty list
     */
    public abstract getContentIfEmpty(): string | undefined;

    public abstract getContextMenuItems(target: Entity<any>, selected: Array<Entity<any>>): IMenuItem[];

    public abstract actions(target: Entity<any> | undefined, selected: Array<Entity<any>>): {
        enable?: () => void,
        disable?: () => void,
        activate?: () => void,
        deactivate?: () => void,
        remove?: () => void,
        edit?: () => void,
    };

    private _onSessionChange(session: ControllerSessionTab | undefined) {
        this._session = session;
        this.setSessionController(session);
        this._subjects.change.next();
    }

}
