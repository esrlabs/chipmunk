import { Component, OnDestroy, ChangeDetectorRef, ViewContainerRef, AfterViewInit, ViewChild, Input, AfterContentInit, ElementRef } from '@angular/core';
import { Subscription, Subject, Observable } from 'rxjs';
import { ViewSearchOutputComponent } from './output/component';
import { IComponentDesc } from 'logviewer-client-containers';
import { ControllerSessionTab } from '../../../controller/controller.session.tab';
import { ControllerSessionScope } from '../../../controller/controller.session.tab.scope';
import { NotificationsService } from '../../../services.injectable/injectable.service.notifications';
import TabsSessionsService from '../../../services/service.sessions.tabs';
import HotkeysService from '../../../services/service.hotkeys';
import SidebarSessionsService from '../../../services/service.sessions.sidebar';
import LayoutStateService from '../../../services/standalone/service.layout.state';
import * as Toolkit from 'logviewer.client.toolkit';

interface IViewState {
    searchRequestId: string | undefined;
    isRequestValid: boolean;
    request: string;
    prevRequest: string;
    isRequestSaved: boolean;
}

const CSettings = {
    viewStateKey: 'search-main-view',
};

@Component({
    selector: 'app-views-search',
    templateUrl: './template.html',
    styleUrls: ['./styles.less']
})

export class ViewSearchComponent implements OnDestroy, AfterViewInit, AfterContentInit {

    @Input() public injectionIntoTitleBar: Subject<IComponentDesc>;
    @Input() public onBeforeTabRemove: Subject<void>;

    @ViewChild('output') _ng_outputComponent: ViewSearchOutputComponent;
    @ViewChild('requestinput') _ng_requestInput: ElementRef;

    public _ng_session: ControllerSessionTab | undefined;
    public _ng_searchRequestId: string | undefined;
    public _ng_isRequestValid: boolean = true;
    public _ng_request: string = '';
    public _ng_prevRequest: string = '';
    public _ng_isRequestSaved: boolean = false;
    // Out of state (stored in controller)
    public _ng_onSessionChanged: Subject<ControllerSessionTab> = new Subject<ControllerSessionTab>();

    private _subscriptions: { [key: string]: Toolkit.Subscription | Subscription | undefined } = { };

    constructor(private _cdRef: ChangeDetectorRef,
                private _vcRef: ViewContainerRef,
                private _notifications: NotificationsService) {
        this._subscriptions.onSessionChange = TabsSessionsService.getObservable().onSessionChange.subscribe(this._onSessionChange.bind(this));
        this._subscriptions.onFocusSearchInput = HotkeysService.getObservable().focusSearchInput.subscribe(this._onFocusSearchInput.bind(this));
        this._setActiveSession();
    }

    ngAfterViewInit() {
        this._loadState();
        this._focus();
    }

    ngAfterContentInit() {
        this._subscriptions.onBeforeTabRemove = this.onBeforeTabRemove.asObservable().subscribe(this._onBeforeTabRemove.bind(this));
    }

    public ngOnDestroy() {
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
        });
        this._saveState();
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

    public _ng_onFocusRequestInput() {
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

    private _onFocusSearchInput() {
        this._focus();
    }

    private _openSidebarSearchTab() {
        if (this._ng_session === undefined) {
            return;
        }
        LayoutStateService.sidebarMax();
        SidebarSessionsService.setActive('search', this._ng_session.getGuid());
    }

    private _onSessionChange(session: ControllerSessionTab | undefined) {
        if (session === undefined) {
            this._ng_session = undefined;
            this._cdRef.detectChanges();
            return;
        }
        this._setActiveSession(session);
        this._cdRef.detectChanges();
    }

    private _setActiveSession(session?: ControllerSessionTab) {
        if (session === undefined) {
            session = TabsSessionsService.getActive();
        } else {
            this._saveState();
        }
        if (session === undefined) {
            return;
        }
        this._ng_session = session;
        this._loadState();
        this._ng_onSessionChanged.next(this._ng_session);
    }

    private _focus(delay: number = 150) {
        setTimeout(() => {
            if (this._ng_requestInput === undefined || this._ng_requestInput === null) {
                return;
            }
            this._ng_requestInput.nativeElement.focus();
        }, delay);
    }

    private _saveState() {
        if (this._ng_session === undefined) {
            return;
        }
        const scope: ControllerSessionScope = this._ng_session.getScope();
        scope.set<IViewState>(CSettings.viewStateKey, {
            isRequestSaved: this._ng_isRequestSaved,
            isRequestValid: this._ng_isRequestValid,
            request: this._ng_request,
            prevRequest: this._ng_prevRequest,
            searchRequestId: this._ng_searchRequestId,
        });
    }

    private _loadState() {
        if (this._ng_session === undefined) {
            return;
        }
        const scope: ControllerSessionScope = this._ng_session.getScope();
        const state: IViewState | undefined = scope.get<IViewState>(CSettings.viewStateKey);
        if (state === undefined) {
            this._ng_isRequestSaved = false;
            this._ng_isRequestValid = true;
            this._ng_request = '';
            this._ng_prevRequest = '';
            this._ng_searchRequestId = undefined;
        } else {
            this._ng_isRequestSaved = state.isRequestSaved;
            this._ng_isRequestValid = state.isRequestValid;
            this._ng_request = state.request;
            this._ng_prevRequest = state.prevRequest;
            this._ng_searchRequestId = state.searchRequestId;
        }
    }

    private _onBeforeTabRemove() {
        this._saveState();
    }

}
