import ServiceElectronIpc, { IPCMessages } from '../../../services/service.electron.ipc';
import { Component, OnDestroy, ChangeDetectorRef, AfterViewInit } from '@angular/core';
import * as Toolkit from 'chipmunk.client.toolkit';
import TabsSessionsService from '../../../services/service.sessions.tabs';
import { Subscription } from 'rxjs';
import { ControllerSessionTab } from '../../../controller/controller.session.tab';

interface IStorage {
    read: number;
    found: number;
}

@Component({
    selector: 'app-apps-status-bar-search-state',
    templateUrl: './template.html',
    styleUrls: ['./styles.less']
})

export class AppsStatusBarSearchStateComponent implements OnDestroy, AfterViewInit {

    public _ng_read: number = 0;
    public _ng_found: number = 0;

    private _logger: Toolkit.Logger = new Toolkit.Logger('AppsStatusBarSearchStateComponent');
    private _subscriptions: { [key: string]: Toolkit.Subscription | Subscription | undefined } = {};
    private _activeSession: string | undefined;
    private _sessions: Map<string, IStorage> = new Map();

    constructor(private _cdRef: ChangeDetectorRef) {

    }

    public ngAfterViewInit() {
        this._subscriptions.onStreamUpdated = TabsSessionsService.getSessionEventsHub().subscribe().onStreamUpdated(this._onStreamUpdated.bind(this));
        this._subscriptions.onSearchUpdated = TabsSessionsService.getSessionEventsHub().subscribe().onSearchUpdated(this._onSearchUpdated.bind(this));
        this._subscriptions.onSessionChange = TabsSessionsService.getObservable().onSessionChange.subscribe(this._onSessionChange.bind(this));
        this._subscriptions.onSessionClosed = TabsSessionsService.getObservable().onSessionClosed.subscribe(this._onSessionClosed.bind(this));
        const controller: ControllerSessionTab | undefined = TabsSessionsService.getActive();
        if (controller === undefined) {
            return;
        }
        this._activeSession = controller.getGuid();
    }

    public ngOnDestroy() {
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
        });
    }

    private _getState(session: string): IStorage {
        let state: IStorage | undefined = this._sessions.get(session);
        if (state === undefined) {
            state = {
                read: 0,
                found: 0,
            };
            this._sessions.set(session, state);
        }
        return state;
    }

    private _onStreamUpdated(event: Toolkit.IEventStreamUpdate) {
        const state: IStorage = this._getState(event.session);
        state.read = event.rows;
        this._sessions.set(event.session, state);
        if (this._activeSession === event.session) {
            this._update();
        }
    }

    private _onSearchUpdated(event: Toolkit.IEventSearchUpdate) {
        const state: IStorage = this._getState(event.session);
        state.found = event.rows;
        this._sessions.set(event.session, state);
        if (this._activeSession === event.session) {
            this._update();
        }
    }

    private _onSessionChange(controller: ControllerSessionTab) {
        if (controller === undefined) {
            return;
        }
        this._activeSession = controller.getGuid();
        this._update();
    }

    private _onSessionClosed(sessionId: string) {
        this._sessions.delete(sessionId);
        if (this._activeSession !== sessionId) {
            return;
        }
        const controller: ControllerSessionTab | undefined = TabsSessionsService.getActive();
        if (controller === undefined) {
            this._activeSession = undefined;
        } else {
            this._activeSession = controller.getGuid();
        }
        this._update();
    }

    private _update() {
        if (this._activeSession === undefined) {
            this._ng_found = 0;
            this._ng_read = 0;
        } else {
            const state: IStorage = this._getState(this._activeSession);
            this._ng_read = state.read;
            this._ng_found = state.found;
        }
        this._cdRef.detectChanges();
    }

}
