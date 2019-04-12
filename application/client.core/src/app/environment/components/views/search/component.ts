import { Component, OnDestroy, ChangeDetectorRef, ViewContainerRef, AfterViewInit, ViewChild, Input, AfterContentInit, ElementRef } from '@angular/core';
import { Subscription } from 'rxjs';
import { ViewSearchOutputComponent } from './output/component';
import { ControllerSessionTab } from '../../../controller/controller.session.tab';
import { ControllerSessionTabSearch } from '../../../controller/controller.session.tab.search';
import { ControllerSessionTabSearchOutput } from '../../../controller/controller.session.tab.search.output';
import { NotificationsService } from '../../../services.injectable/injectable.service.notifications';
import TabsSessionsService from '../../../services/service.sessions.tabs';
import ElectronIpcService, { IPCMessages } from '../../../services/service.electron.ipc';
import * as Toolkit from 'logviewer.client.toolkit';

@Component({
    selector: 'app-views-search',
    templateUrl: './template.html',
    styleUrls: ['./styles.less']
})

export class ViewSearchComponent implements OnDestroy, AfterViewInit, AfterContentInit {

    @ViewChild('output') _ng_outputComponent: ViewSearchOutputComponent;
    @ViewChild('requestinput') _ng_input: ElementRef;

    public _ng_session: ControllerSessionTab | undefined;
    public _ng_searchRequestId: string | undefined;
    public _ng_isRequestValid: boolean = true;

    private _subscriptionsSession: { [key: string]: Toolkit.Subscription | Subscription | undefined } = { };
    private _subscriptionsSearch: { [key: string]: Toolkit.Subscription | Subscription | undefined } = { };

    constructor(private _cdRef: ChangeDetectorRef,
                private _vcRef: ViewContainerRef,
                private _notifications: NotificationsService) {
        this._onSessionChange = this._onSessionChange.bind(this);
        this._onSearchStarted = this._onSearchStarted.bind(this);
        this._onSearchFinished = this._onSearchFinished.bind(this);
        this._subscriptionsSession.onSessionChange = TabsSessionsService.getObservable().onSessionChange.subscribe(this._onSessionChange);
        this._setActiveSession();
    }

    ngAfterViewInit() {
    }

    ngAfterContentInit() {
        if (this._ng_outputComponent === undefined) {
            return;
        }
    }

    public ngOnDestroy() {
        this._unsubscribeSearch();
        Object.keys(this._subscriptionsSession).forEach((key: string) => {
            this._subscriptionsSession[key].unsubscribe();
        });
    }

    public _ng_onKeyUp(event: KeyboardEvent) {
        if (this._ng_searchRequestId !== undefined) {
            return;
        }
        const value: string = (event.target as HTMLInputElement).value;
        this._ng_isRequestValid = Toolkit.regTools.isRegStrValid(value);
        this._cdRef.detectChanges();
        if (event.key !== 'Enter') {
            return;
        }
        // this._ng_output.clearStream();
        if (value.trim() === '') {
            return this._cdRef.detectChanges();
        }
        if (!this._ng_isRequestValid) {
            return this._notifications.add({
                caption: 'Search',
                message: `Regular expresion isn't valid. Please correct it.`
            });
        }
        this._ng_searchRequestId = Toolkit.guid();
        this._ng_session.getSessionSearch().search(
            this._ng_searchRequestId,
            [Toolkit.regTools.createFromStr(value, 'gim') as RegExp]
        ).then(() => {
            // Search done
        }).catch((searchError: Error) => {
            this._ng_searchRequestId = undefined;
            this._cdRef.detectChanges();
            return this._notifications.add({
                caption: 'Search',
                message: `Cannot to do due error: ${searchError.message}.`
            });
        });
        (event.target as HTMLInputElement).value = '';
        this._cdRef.detectChanges();
    }

    private _subscribeSearch() {
        this._unsubscribeSearch();
        this._subscriptionsSearch.onSearchStarted = this._ng_session.getSessionSearch().getObservable().onSearchStarted.subscribe(this._onSearchStarted);
        this._subscriptionsSearch.onSearchFinished = this._ng_session.getSessionSearch().getObservable().onSearchFinished.subscribe(this._onSearchFinished);
    }

    private _unsubscribeSearch() {
        Object.keys(this._subscriptionsSearch).forEach((key: string) => {
            this._subscriptionsSearch[key].unsubscribe();
        });
    }

    private _onSearchFinished(requestId: string) {
        if (this._ng_searchRequestId !== requestId) {
            return;
        }
        this._ng_searchRequestId = undefined;
    }

    private _onSearchStarted(requestId: string) {
        // Do nothing
    }

    private _onSessionChange(session: ControllerSessionTab) {
        this._setActiveSession(session);
        this._cdRef.detectChanges();
    }

    private _setActiveSession(session?: ControllerSessionTab) {
        if (session === undefined) {
            session = TabsSessionsService.getActive();
        }
        if (session === undefined) {
            return;
        }
        this._ng_session = session;
        this._subscribeSearch();
    }

}
