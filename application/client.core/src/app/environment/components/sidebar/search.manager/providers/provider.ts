import { Subject, Observable, Subscription } from 'rxjs';
import { Entity } from './entity';
import { ControllerSessionTab } from '../../../../controller/controller.session.tab';
import { IComponentDesc } from 'chipmunk-client-material';
import { KeyboardListener } from './keyboard.listener';

import EventsSessionService from '../../../../services/standalone/service.events.session';
import TabsSessionsService from '../../../../services/service.sessions.tabs';

import * as Toolkit from 'chipmunk.client.toolkit';

export enum EProviders {
    filters = 'filters',
    charts = 'charts',
}

export interface ISelectEvent {
    provider: Provider<any>;
    guids: string[];
    sender?: string;
}

export abstract class Provider<T> {

    private _subjects: {
        change: Subject<void>,
        selection: Subject<ISelectEvent>,
        edit: Subject<string | undefined>,
    } = {
        change: new Subject(),
        selection: new Subject(),
        edit: new Subject(),
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

    public setSelection(guid: string, sender?: string) {
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
    }

    public dropSelection(sender?: string) {
        if (this._selection.length === 0) {
            return;
        }
        this._selection = [];
        this._subjects.selection.next({
            provider: this,
            guids: this._selection,
            sender: sender,
        });
    }

    public getSelection(): string[] {
        return this._selection.slice();
    }

    public getSingleSelection(): Entity<T> | undefined {
        if (this._selection.length !== 1) {
            return undefined;
        }
        return this.get().find((entity: Entity<T>) => {
            return entity.getGUID() === this._selection[0];
        });
    }

    public editIn() {
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
    }

    public editOut() {
        this.get().forEach((entity: Entity<any>) => {
            entity.getEditState().out();
        });
        this._subjects.edit.next(undefined);
    }

    public getObservable(): {
        change: Observable<void>,
        selection: Observable<ISelectEvent>,
        edit: Observable<string | undefined>,
    } {
        return {
            change: this._subjects.change.asObservable(),
            selection: this._subjects.selection.asObservable(),
            edit: this._subjects.edit.asObservable(),
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

    private _onSessionChange(session: ControllerSessionTab | undefined) {
        this._session = session;
        this.setSessionController(session);
        this._subjects.change.next();
    }

}
