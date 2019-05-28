import { Component, OnDestroy, ChangeDetectorRef, ViewContainerRef, AfterViewInit, ViewChild, Input, AfterContentInit, ElementRef } from '@angular/core';
import { Subscription } from 'rxjs';
import { ViewSearchOutputComponent } from './output/component';
import { ControllerSessionTab } from '../../../controller/controller.session.tab';
import { NotificationsService } from '../../../services.injectable/injectable.service.notifications';
import TabsSessionsService from '../../../services/service.sessions.tabs';
import LayoutStateService from '../../../services/standalone/service.layout.state';
import * as Toolkit from 'logviewer.client.toolkit';

@Component({
    selector: 'app-views-search',
    templateUrl: './template.html',
    styleUrls: ['./styles.less']
})

export class ViewSearchComponent implements OnDestroy, AfterViewInit, AfterContentInit {

    @ViewChild('output') _ng_outputComponent: ViewSearchOutputComponent;
    @ViewChild('requestinput') _ng_requestInput: ElementRef;

    public _ng_session: ControllerSessionTab | undefined;
    public _ng_searchRequestId: string | undefined;
    public _ng_isRequestValid: boolean = true;
    public _ng_request: string = '';
    public _ng_prevRequest: string = '';
    public _ng_isRequestSaved: boolean = false;

    private _subscriptions: { [key: string]: Toolkit.Subscription | Subscription | undefined } = { };

    constructor(private _cdRef: ChangeDetectorRef,
                private _vcRef: ViewContainerRef,
                private _notifications: NotificationsService) {
        this._onSessionChange = this._onSessionChange.bind(this);
        this._subscriptions.onSessionChange = TabsSessionsService.getObservable().onSessionChange.subscribe(this._onSessionChange);
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
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
        });
    }

    public _ng_isWorking(): boolean {
        return this._ng_searchRequestId !== undefined;
    }

    public _ng_onKeyUpRequestInput(event: KeyboardEvent) {
        if (this._ng_searchRequestId !== undefined) {
            return;
        }
        this._ng_isRequestValid = Toolkit.regTools.isRegStrValid(this._ng_request);
        this._cdRef.detectChanges();
        if (event.key !== 'Enter') {
            return;
        }
        if (this._ng_request.trim() === '') {
            // Drop results
            return this._ng_onDropRequest();
        }
        if (!this._ng_isRequestValid) {
            return this._notifications.add({
                caption: 'Search',
                message: `Regular expresion isn't valid. Please correct it.`
            });
        }
        if (this._ng_prevRequest.trim() !== '' && this._ng_request === this._ng_prevRequest) {
            if (this._ng_isRequestSaved) {
                return;
            }
            this._ng_onStoreRequest();
            return;
        }
        this._ng_searchRequestId = Toolkit.guid();
        this._ng_prevRequest = this._ng_request;
        this._ng_session.getSessionSearch().search(
            this._ng_searchRequestId,
            [Toolkit.regTools.createFromStr(this._ng_request, 'gim') as RegExp]
        ).then(() => {
            // Search done
            this._ng_searchRequestId = undefined;
            this._ng_isRequestSaved = this._ng_session.getSessionSearch().isRequestStored(this._ng_request);
            this._focus();
            this._cdRef.detectChanges();
        }).catch((searchError: Error) => {
            this._ng_searchRequestId = undefined;
            this._cdRef.detectChanges();
            return this._notifications.add({
                caption: 'Search',
                message: `Cannot to do a search due error: ${searchError.message}.`
            });
        });
        this._cdRef.detectChanges();
    }

    public _ng_onBlurRequestInput() {
        this._ng_request = this._ng_prevRequest;
        this._cdRef.detectChanges();
    }

    public _ng_onDropRequest() {
        // Drop results
        this._ng_searchRequestId = Toolkit.guid();
        this._ng_session.getSessionSearch().drop(this._ng_searchRequestId).then(() => {
            this._ng_prevRequest = '';
            this._ng_request = '';
            this._ng_isRequestSaved = false;
            this._ng_searchRequestId = undefined;
            this._focus();
            this._cdRef.detectChanges();
        }).catch((droppingError: Error) => {
            this._ng_searchRequestId = undefined;
            this._cdRef.detectChanges();
            return this._notifications.add({
                caption: 'Search',
                message: `Cannot drop results due error: ${droppingError.message}.`
            });
        });
        return this._cdRef.detectChanges();
    }

    public _ng_onStoreRequest() {
        if (this._ng_isRequestSaved) {
            return;
        }
        this._openSidebarSearchTab();
        this._ng_session.getSessionSearch().addStored(this._ng_request);
        this._ng_isRequestSaved = this._ng_session.getSessionSearch().isRequestStored(this._ng_request);
        this._cdRef.detectChanges();
    }

    private _openSidebarSearchTab() {
        LayoutStateService.sidebarMax();
        TabsSessionsService.openTab('search');
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
    }

    private _focus() {
        setTimeout(() => {
            if (this._ng_requestInput === undefined || this._ng_requestInput === null) {
                return;
            }
            this._ng_requestInput.nativeElement.focus();
        }, 150);
    }

}
