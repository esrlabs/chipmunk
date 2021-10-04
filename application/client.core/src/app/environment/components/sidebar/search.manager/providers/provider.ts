import { Subject, Observable, Subscription } from 'rxjs';
import { CdkDragDrop } from '@angular/cdk/drag-drop';
import { Entity } from './entity';
import { TRequest, EListID } from '../service/service';
import { Session } from '../../../../controller/session/session';
import { IComponentDesc } from 'chipmunk-client-material';
import { KeyboardListener } from './keyboard.listener';
import { IMenuItem } from '../../../../services/standalone/service.contextmenu';
import { EntityData } from './entity.data';

import EventsSessionService from '../../../../services/standalone/service.events.session';
import TabsSessionsService from '../../../../services/service.sessions.tabs';

import * as Toolkit from 'chipmunk.client.toolkit';

export enum EProviders {
    filters = 'filters',
    charts = 'charts',
    ranges = 'ranges',
    disabled = 'disabled',
}

export interface ISelectEvent {
    provider: Provider<any>;
    entity: Entity<any> | undefined;
    guids: string[];
    sender?: string;
}

export interface IContextMenuEvent {
    event: MouseEvent;
    provider: Provider<any>;
    entity: Entity<any>;
    items?: IMenuItem[];
}

export interface IDoubleclickEvent {
    event: MouseEvent;
    provider: Provider<any>;
    entity: Entity<any>;
}

export interface ISelection {
    guid: string; // GUID of entity
    sender?: string; // Name of provider/controller/etc who emits actions (we need it to prevent loop in event circle)
    ignore?: boolean; // true - drops state of ctrl and shift; false - ctrl and shift would be considering
    toggle?: boolean; // used only with single selection
    // true - if entity already selected, selection would be dropped
    // false - defined entity would be selected in anyway
}

export enum EActions {
    enable = 'enable',
    disable = 'disable',
    remove = 'remove',
    activate = 'activate',
    deactivate = 'deactivate',
    edit = 'edit',
}

interface IStoredSelection {
    current: string[];
    last: Entity<any> | undefined;
}

type ProvidersGetter = () => Provider<any>[];

export abstract class Provider<T> {
    private _subjects: {
        change: Subject<void>;
        selection: Subject<ISelectEvent>;
        edit: Subject<string | undefined>;
        context: Subject<IContextMenuEvent>;
        doubleclick: Subject<IDoubleclickEvent>;
        reload: Subject<string>;
    } = {
        change: new Subject(),
        selection: new Subject(),
        edit: new Subject(),
        context: new Subject(),
        doubleclick: new Subject(),
        reload: new Subject(),
    };
    private _session: Session | undefined;
    private _selection: IStoredSelection = {
        current: [],
        last: undefined,
    };
    private _keyboard: KeyboardListener | undefined;
    private _subscriptions: { [key: string]: Subscription } = {};
    private _guid: string = Toolkit.guid();
    private _providers: ProvidersGetter | undefined;

    constructor() {
        this._session = TabsSessionsService.getActive();
        this._subscriptions.onSessionChange =
            EventsSessionService.getObservable().onSessionChange.subscribe(
                this._onSessionChange.bind(this),
            );
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

    public setProvidersGetter(getter: () => Provider<any>[]) {
        this._providers = getter;
    }

    public setLastSelection(selection: Entity<any> | undefined) {
        this._selection.last = selection;
    }

    public openSearchToolbarApp(): Promise<void> {
        const def_toolbar_apps = TabsSessionsService.bars().getDefsToolbarApps();
        return def_toolbar_apps !== undefined
            ? TabsSessionsService.bars().openToolbarApp(def_toolbar_apps.search, false)
            : Promise.reject(new Error(`Fail get default toolbar apps list`));
    }

    public select(): {
        first: () => void;
        last: () => void;
        next: () => boolean;
        prev: () => boolean;
        drop: (sender?: string) => void;
        apply: (sender: string, guids: string[]) => void;
        get: () => string[];
        getEntities: () => Array<Entity<T>>;
        set: (selection: ISelection) => void;
        single: () => Entity<T> | undefined;
        context: (event: MouseEvent, entity: Entity<T>) => void;
        doubleclick: (event: MouseEvent, entity: Entity<T>) => void;
    } {
        const setSelection: (selection: ISelection) => void = (selection: ISelection) => {
            const index: number = this._selection.current.indexOf(selection.guid);
            let entity: Entity<T> | undefined;
            if (this._keyboard !== undefined && selection.ignore) {
                this._keyboard.ignore_ctrl_shift();
            }
            if (this._keyboard !== undefined && this._keyboard.ctrl()) {
                if (index === -1) {
                    this._selection.current.push(selection.guid);
                    entity = this.get().find((e) => e.getGUID() === selection.guid);
                }
            } else if (
                this._keyboard !== undefined &&
                this._providers !== undefined &&
                this._keyboard.shift() &&
                this._selection.last !== undefined
            ) {
                let guids: string[] = ([] as string[]).concat.apply(
                    [],
                    this._providers().map((p) => p.get().map((e) => e.getGUID())),
                );
                const from: number = guids.findIndex((g) => g === this._selection.last?.getGUID());
                const to: number = guids.findIndex((g) => g === selection.guid);
                if (from !== -1 && to !== -1) {
                    guids = guids.slice(Math.min(from, to), Math.max(from, to) + 1);
                    this._selection.current = this._selection.current.concat(
                        guids.filter((g) => this._selection.current.indexOf(g) === -1),
                    );
                }
                entity = this._selection.last;
            } else {
                if (index === -1) {
                    this._selection.current = [selection.guid];
                    entity = this.get().find((e) => e.getGUID() === selection.guid);
                } else {
                    if (selection.toggle !== false) {
                        this._selection.current = [];
                    }
                }
            }
            this._subjects.selection.next({
                provider: this,
                entity: entity,
                guids: this._selection.current,
                sender: selection.sender,
            });
        };
        return {
            first: () => {
                const entities = this.get();
                if (entities.length === 0) {
                    return;
                }
                setSelection({
                    guid: entities[0].getGUID(),
                    sender: 'self.first',
                });
            },
            last: () => {
                const entities = this.get();
                if (entities.length === 0) {
                    return;
                }
                setSelection({
                    guid: entities[entities.length - 1].getGUID(),
                    sender: 'self.last',
                });
            },
            next: () => {
                if (this._selection.current.length !== 1) {
                    return false;
                }
                const entities = this.get();
                let index: number = -1;
                entities.forEach((entity, i) => {
                    if (entity.getGUID() === this._selection.current[0]) {
                        index = i;
                    }
                });
                if (index === -1) {
                    return false;
                }
                if (index + 1 > entities.length - 1) {
                    return false;
                }
                setSelection({
                    guid: entities[index + 1].getGUID(),
                    sender: 'self.next',
                });
                return true;
            },
            prev: () => {
                if (this._selection.current.length !== 1) {
                    return false;
                }
                const entities = this.get();
                let index: number = -1;
                entities.forEach((entity, i) => {
                    if (entity.getGUID() === this._selection.current[0]) {
                        index = i;
                    }
                });
                if (index === -1) {
                    return false;
                }
                if (index - 1 < 0) {
                    return false;
                }
                setSelection({
                    guid: entities[index - 1].getGUID(),
                    sender: 'self.next',
                });
                return true;
            },
            drop: (sender?: string) => {
                if (this._selection.current.length === 0) {
                    return;
                }
                this._selection.current = [];
                this._subjects.selection.next({
                    provider: this,
                    entity: undefined,
                    guids: this._selection.current,
                    sender: sender,
                });
            },
            apply: (sender: string, guids: string[]) => {
                const own: string[] = this.get().map((e) => e.getGUID());
                this._selection.current = guids.filter((g) => own.indexOf(g) !== -1);
                this._subjects.selection.next({
                    provider: this,
                    entity: undefined,
                    guids: this._selection.current,
                    sender: sender,
                });
            },
            get: () => {
                return this._selection.current.slice();
            },
            getEntities: () => {
                const entities: Entity<any>[] = [];
                this.get().forEach((entity: Entity<T>) => {
                    if (this._selection.current.indexOf(entity.getGUID()) === -1) {
                        return;
                    }
                    entities.push(entity);
                });
                return entities;
            },
            set: setSelection,
            single: () => {
                if (this._selection.current.length !== 1) {
                    return undefined;
                }
                return this.get().find((entity: Entity<T>) => {
                    return entity.getGUID() === this._selection.current[0];
                });
            },
            context: (event: MouseEvent, entity: Entity<T>) => {
                this._subjects.context.next({
                    event: event,
                    entity: entity,
                    provider: this,
                });
            },
            doubleclick: (event: MouseEvent, entity: Entity<T>) => {
                this._subjects.doubleclick.next({
                    event: event,
                    entity: entity,
                    provider: this,
                });
                setSelection({
                    guid: entity.getGUID(),
                    sender: 'self.doubleclick',
                    toggle: false,
                });
            },
        };
    }

    public edit(): {
        in: () => void;
        out: () => void;
    } {
        return {
            in: () => {
                if (this._selection.current.length !== 1) {
                    return;
                }
                const guid: string = this._selection.current[0];
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
                this.change();
            },
        };
    }

    public getObservable(): {
        change: Observable<void>;
        selection: Observable<ISelectEvent>;
        edit: Observable<string | undefined>;
        context: Observable<IContextMenuEvent>;
        doubleclick: Observable<IDoubleclickEvent>;
        reload: Observable<string>;
    } {
        return {
            change: this._subjects.change.asObservable(),
            selection: this._subjects.selection.asObservable(),
            edit: this._subjects.edit.asObservable(),
            context: this._subjects.context.asObservable(),
            doubleclick: this._subjects.doubleclick.asObservable(),
            reload: this._subjects.reload.asObservable(),
        };
    }

    public change() {
        this._subjects.change.next();
    }

    public getSession(): Session | undefined {
        return this._session;
    }

    public isEmpty(): boolean {
        return this.get().length === 0;
    }

    public abstract unsubscribe(): void;

    public abstract get(): Entity<T>[];

    public abstract reorder(params: { prev: number; curt: number }): void;

    public abstract getPanelName(): string;

    public abstract getPanelDesc(): string;

    public abstract getDetailsPanelName(): string | undefined;

    public abstract getDetailsPanelDesc(): string | undefined;

    public abstract getListComp(): IComponentDesc;

    public abstract getDetailsComp(): IComponentDesc | undefined;

    public abstract search(entity: Entity<T>): void;

    public abstract isViable(): boolean;

    public abstract itemDragged(event: CdkDragDrop<EntityData<TRequest>>): void;

    public abstract get listID(): EListID;

    /**
     * Should called in inherit class in constructor
     * @param session
     */
    public abstract setSessionController(session: Session | undefined): void;

    /**
     * Should return undefined to hide panel in case of empty list
     */
    public abstract getContentIfEmpty(): IComponentDesc | undefined;

    public abstract getContextMenuItems(
        target: Entity<any>,
        selected: Array<Entity<any>>,
    ): IMenuItem[];

    public abstract actions(
        target: Entity<any> | undefined,
        selected: Array<Entity<any>>,
    ): {
        activate?: () => void;
        deactivate?: () => void;
        remove?: () => void;
        edit?: () => void;
    };

    private _onSessionChange(session: Session | undefined) {
        this._session = session;
        // Change session
        this.setSessionController(session);
        // Force loading of entities
        this.get();
        // Trigger event of changes
        this._subjects.change.next();
        // Trigger event of reloading
        this._subjects.reload.next(this.getGuid());
    }
}
