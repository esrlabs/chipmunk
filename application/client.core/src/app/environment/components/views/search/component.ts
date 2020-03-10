import { Component, OnDestroy, ChangeDetectorRef, AfterViewInit, ViewChild, Input, AfterContentInit, ElementRef, ViewEncapsulation } from '@angular/core';
import { Subscription, Subject, Observable } from 'rxjs';
import { ViewSearchOutputComponent } from './output/component';
import { IComponentDesc } from 'chipmunk-client-material';
import { ControllerSessionTab } from '../../../controller/controller.session.tab';
import { ControllerSessionScope } from '../../../controller/controller.session.tab.scope';
import { FiltersStorage, FilterRequest } from '../../../controller/controller.session.tab.search.filters.storage';
import { ChartsStorage, ChartRequest } from '../../../controller/controller.session.tab.search.charts.storage';
import { NotificationsService } from '../../../services.injectable/injectable.service.notifications';
import { rankedNumberAsString } from '../../../controller/helpers/ranks';
import { map, startWith } from 'rxjs/operators';
import { FormControl } from '@angular/forms';
import { MatInput, MatAutocompleteSelectedEvent, MatAutocompleteTrigger } from '@angular/material';
import ContextMenuService, { IMenuItem } from '../../../services/standalone/service.contextmenu';

import TabsSessionsService from '../../../services/service.sessions.tabs';
import HotkeysService from '../../../services/service.hotkeys';
import SidebarSessionsService from '../../../services/service.sessions.sidebar';
import LayoutStateService from '../../../services/standalone/service.layout.state';

import ElectronIpcService, { IPCMessages } from '../../../services/service.electron.ipc';

import * as Toolkit from 'chipmunk.client.toolkit';
import { EChartType } from '../chart/charts/charts';
/*
TODO: numbers from x xxx xxx to xK or xM -> to safe space in status bar (summury <P>)
*/
interface IViewState {
    searchRequestId: string | undefined;
    isRequestValid: boolean;
    request: string;
    prevRequest: string;
    isRequestSaved: boolean;
    read: number;
    found: number;
}

const CSettings = {
    viewStateKey: 'search-main-view',
};

@Component({
    selector: 'app-views-search',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
    encapsulation: ViewEncapsulation.None
})

export class ViewSearchComponent implements OnDestroy, AfterViewInit, AfterContentInit {

    @Input() public injectionIntoTitleBar: Subject<IComponentDesc>;
    @Input() public onBeforeTabRemove: Subject<void>;
    @Input() public setActiveTab: (guid: string) => void;
    @Input() public getDefaultsTabGuids: () => { charts: string };
    @Input() public onTitleContextMenu: Observable<MouseEvent>;

    @ViewChild('output', { static: false }) _ng_outputComponent: ViewSearchOutputComponent;
    @ViewChild(MatInput, { static: false }) _ng_inputComRef: MatInput;
    @ViewChild('requestinput', { static: false }) _ng_requestInputComRef: ElementRef;
    @ViewChild(MatAutocompleteTrigger, {static: false}) _ng_autoComRef: MatAutocompleteTrigger;

    public _ng_session: ControllerSessionTab | undefined;
    public _ng_searchRequestId: string | undefined;
    public _ng_isRequestValid: boolean = true;
    public _ng_isRequestSaved: boolean = false;
    public _ng_read: number = -1;
    public _ng_found: number = -1;
    // Out of state (stored in controller)
    public _ng_onSessionChanged: Subject<ControllerSessionTab> = new Subject<ControllerSessionTab>();
    public _ng_inputCtrl = new FormControl();
    public _ng_recent: Observable<string[]>;
    public _ng_flags: {
        casesensitive: boolean,
        wholeword: boolean,
        regexp: boolean,
    } = {
        casesensitive: false,
        wholeword: false,
        regexp: true,
    };

    private _logger: Toolkit.Logger = new Toolkit.Logger('ViewSearchComponent');
    private _subscriptions: { [key: string]: Toolkit.Subscription | Subscription } = { };
    private _sessionSubscriptions: { [key: string]: Subscription } = { };
    private _prevRequest: string = '';
    private _recent: string[] = [ ];
    private _fakeInputKeyEvent: boolean = false;
    private _selectedTextOnInputClick: boolean = false;
    private _filtersStorage: FiltersStorage | undefined;
    private _chartsStorage: ChartsStorage | undefined;
    private _destroyed: boolean = false;

    constructor(private _cdRef: ChangeDetectorRef,
                private _notifications: NotificationsService) {
        this._subscriptions.onSessionChange = TabsSessionsService.getObservable().onSessionChange.subscribe(this._onSessionChange.bind(this));
        this._subscriptions.onFocusSearchInput = HotkeysService.getObservable().focusSearchInput.subscribe(this._onFocusSearchInput.bind(this));
        this._subscriptions.onToolbarToggle = HotkeysService.getObservable().toolbarToggle.subscribe(this._onToolbarToggle.bind(this));
        this._subscriptions.onStreamUpdated = TabsSessionsService.getSessionEventsHub().subscribe().onStreamUpdated(this._onStreamUpdated.bind(this));
        this._subscriptions.onSearchUpdated = TabsSessionsService.getSessionEventsHub().subscribe().onSearchUpdated(this._onSearchUpdated.bind(this));
        this._setActiveSession();
    }

    ngAfterViewInit() {
        this._loadState();
        this._focus();
    }

    ngAfterContentInit() {
        this._subscriptions.onBeforeTabRemove = this.onBeforeTabRemove.asObservable().subscribe(this._onBeforeTabRemove.bind(this));
        this._subscriptions.onTitleContextMenu = this.onTitleContextMenu.subscribe(this._onTitleContextMenu.bind(this));
        this._loadRecentFilters();
        this._ng_recent = this._ng_inputCtrl.valueChanges.pipe(
            startWith(''),
            map(value => this._filterRecentRequest(value))
        );
    }

    public ngOnDestroy() {
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
        });
        Object.keys(this._sessionSubscriptions).forEach((key: string) => {
            this._sessionSubscriptions[key].unsubscribe();
        });
        this._saveState();
        this._destroyed = true;
    }

    public _ng_isWorking(): boolean {
        return this._ng_searchRequestId !== undefined;
    }

    public _ng_onKeyUpRequestInput(event?: KeyboardEvent) {
        if (this._fakeInputKeyEvent) {
            // We need fake flag to allow selecting item from popup by keyboard.
            // The issue is: we have 2 events there: pressed ENTER
            // _ng_onKeyUpRequestInput and also _ng_onRecentSelected
            this._fakeInputKeyEvent = false;
            return;
        }
        if (event === undefined) {
            this._fakeInputKeyEvent = true;
            setTimeout(() => {
                // Drop fake event flag with timeout
                this._fakeInputKeyEvent = false;
            }, 500);
        }
        if (event !== undefined && event.key !== 'Enter' && event.key !== 'Escape') {
            return;
        }
        if (this._ng_searchRequestId !== undefined) {
            return;
        }
        this._ng_isRequestValid = Toolkit.regTools.isRegStrValid(this._ng_inputCtrl.value);
        this._forceUpdate();
        if (event !== undefined && event.key === 'Escape') {
            if (this._ng_inputCtrl.value !== '') {
                // Drop results
                this._ng_onDropRequest(true);
            } else {
                // Drop a focus
                this._blur();
            }
            return;
        }
        if (this._ng_inputCtrl.value === undefined || this._ng_inputCtrl.value.trim() === '') {
            // Drop results
            return this._ng_onDropRequest(true);
        }
        if (!this._ng_isRequestValid) {
            return this._notifications.add({
                caption: 'Search',
                message: `Regular expresion isn't valid. Please correct it.`
            });
        }
        if (this._prevRequest.trim() !== '' && this._ng_inputCtrl.value === this._prevRequest) {
            if (this._ng_isRequestSaved) {
                return;
            }
            this._ng_onStoreRequest();
            return;
        }
        this._addRecentFilter();
        this._search();
    }

    public _ng_onFocusRequestInput() {
        this._ng_autoComRef.openPanel();
        if (this._ng_inputCtrl.value === '') {
            return;
        }
    }

    public _ng_onClickRequestInput() {
        if (this._selectedTextOnInputClick) {
            return;
        }
        this._selectedTextOnInputClick = true;
        this._selectTextInInput();
    }

    public _ng_onBlurRequestInput() {
        // Do it with timeout, because it might be selection by click in panel
        setTimeout(() => {
            if (this._ng_autoComRef === undefined) {
                return;
            }
            this._ng_inputCtrl.setValue(this._prevRequest);
            this._ng_autoComRef.closePanel();
            // And do this because Angular still didn't fix a bug: https://github.com/angular/components/issues/7066
            setTimeout(() => {
                if (this._ng_autoComRef === undefined) {
                    return;
                }
                this._ng_autoComRef.closePanel();
                this._forceUpdate();
            });
        }, 250);
        this._selectedTextOnInputClick = false;
    }

    public _ng_onDropRequest(focus: boolean = false): Promise<string | void> {
        // Drop results
        this._ng_searchRequestId = Toolkit.guid();
        this._forceUpdate();
        return this._ng_session.getSessionSearch().getFiltersAPI().drop(this._ng_searchRequestId).then(() => {
            this._prevRequest = '';
            this._ng_inputCtrl.setValue('');
            this._ng_isRequestSaved = false;
            this._ng_searchRequestId = undefined;
            this._ng_found = -1;
            this._ng_read = -1;
            this._forceUpdate();
            if (focus) {
                this._focus();
            }
        }).catch((droppingError: Error) => {
            this._ng_searchRequestId = undefined;
            this._forceUpdate();
            return this._notifications.add({
                caption: 'Search',
                message: `Cannot drop results due error: ${droppingError.message}.`
            });
        });
    }

    public _ng_onStoreRequest() {
        if (this._ng_isRequestSaved) {
            return;
        }
        this._openSidebarSearchTab();
        const request: FilterRequest | Error = this._getCurrentFilter();
        if (request instanceof Error) {
            return;
        }
        if (this._filtersStorage.has(request)) {
            return;
        }
        this._filtersStorage.add(request);
        this._ng_isRequestSaved = true;
        this._ng_onDropRequest(false);
    }

    public _ng_onStoreChart() {
        if (this._ng_isRequestSaved) {
            return;
        }
        this._openSidebarSearchTab();
        const request: ChartRequest | Error = this._getCurrentChart();
        if (request instanceof Error) {
            return;
        }
        if (this._chartsStorage.has(request)) {
            return;
        }
        if (request instanceof Error) {
            return this._notifications.add({
                caption: 'Chart',
                message: `Not valid regular expression for chart: "${request.message}"`
            });
        }
        this._chartsStorage.add(request);
        this._ng_isRequestSaved = true;
        this._ng_onDropRequest(false).then(() => {
            if (this.setActiveTab === undefined || this.getDefaultsTabGuids === undefined) {
                return;
            }
            this.setActiveTab(this.getDefaultsTabGuids().charts);
        });
    }

    public _ng_getMatchesProc(): string {
        const proc: number = this._ng_found / this._ng_read;
        if (isNaN(proc) || !isFinite(proc)) {
            return '0.00';
        }
        return (proc * 100).toFixed(2);
    }

    public _ng_isSummaryVisible(): boolean {
        return this._ng_read !== -1 && this._ng_found !== -1;
    }

    public _ng_isButtonsVisible(): boolean {
        if (this._prevRequest === this._ng_inputCtrl.value && this._ng_inputCtrl.value !== '') {
            this._ng_session.getSessionSearch().getFiltersAPI().getState().lock();
            return true;
        } else {
            this._ng_session.getSessionSearch().getFiltersAPI().getState().unlock();
            return false;
        }
    }

    public _ng_onRecentSelected(event: MatAutocompleteSelectedEvent) {
        this._ng_inputCtrl.setValue(event.option.viewValue);
        this._ng_onKeyUpRequestInput();
    }

    public _ng_flagsToggle(event: MouseEvent, key: string) {
        this._ng_flags[key] = !this._ng_flags[key];
        this._forceUpdate();
        if (this._ng_session.getSessionSearch().getFiltersAPI().getState().isLocked()) {
            // Trigger re-search only if it was done already before
            this._search(false);
        }
        (event.target as any).focus();
        event.preventDefault();
        event.stopImmediatePropagation();
    }

    public _ng_getFound(): string {
        if (this._ng_found <= 0) {
            return '0';
        } else {
            return rankedNumberAsString(this._ng_found);
        }
    }

    public _ng_getTotal(): string {
        if (this._ng_read <= 0) {
            return '0';
        } else {
            return rankedNumberAsString(this._ng_read);
        }
    }

    private _getCurrentFilter(): FilterRequest | Error {
        try {
            return new FilterRequest({
                request: this._ng_inputCtrl.value,
                flags: Object.assign({}, this._ng_flags)
            });
        } catch (err) {
            return err;
        }
    }

    private _getCurrentChart(): ChartRequest | Error {
        try {
            return new ChartRequest({
                request: this._ng_inputCtrl.value,
                type: EChartType.stepped,
            });
        } catch (err) {
            return err;
        }
    }

    private _clearRecent() {
        this._ng_autoComRef.closePanel();
        this._ng_inputCtrl.updateValueAndValidity();
        ElectronIpcService.request(new IPCMessages.SearchRecentClearRequest(), IPCMessages.SearchRecentClearResponse).then((response: IPCMessages.SearchRecentClearResponse) => {
            this._loadRecentFilters();
            if (response.error) {
                return this._logger.error(`Fail to reset recent filters due error: ${response.error}`);
            }
        }).catch((error: Error) => {
            return this._logger.error(`Fail send request to reset recent filters due error: ${error.message}`);
        });
    }

    private _search(focus: boolean = true) {
        const request: FilterRequest | Error = this._getCurrentFilter();
        if (request instanceof Error) {
            return this._notifications.add({
                caption: 'Search',
                message: `Regular expresion isn't valid. Please correct it.`
            });
        }
        this._ng_searchRequestId = Toolkit.guid();
        this._prevRequest = this._ng_inputCtrl.value;
        this._ng_session.getSessionSearch().getFiltersAPI().search(this._ng_searchRequestId, request).then((count: number | undefined) => {
            this._onSearchUpdated( { session: this._ng_session.getGuid(), rows: count } );
            // Search done
            this._ng_searchRequestId = undefined;
            this._ng_isRequestSaved = this._filtersStorage.has(request);
            if (focus) {
                this._focus();
            }
            this._forceUpdate();
        }).catch((searchError: Error) => {
            this._ng_searchRequestId = undefined;
            this._forceUpdate();
            return this._notifications.add({
                caption: 'Search',
                message: `Cannot to do a search due error: ${searchError.message}.`
            });
        });
        this._forceUpdate();
    }

    private _onFocusSearchInput() {
        const selection: string = document.getSelection().toString();
        if (selection.trim() === '' || selection.search(/[\n\r]/gi) !== -1 || selection.length > 100) {
            this._focus();
        } else {
            try {
                const request: FilterRequest = new FilterRequest({
                    request: selection,
                    flags: { casesensitive: true, wholeword: true, regexp: false },
                });
                document.getSelection().removeAllRanges();
                this._onForceSearch(request);
            } catch (e) {
                return undefined;
            }
        }
    }

    private _onToolbarToggle() {
        if (this._ng_autoComRef === undefined) {
            return;
        }
        this._ng_autoComRef.closePanel();
    }

    private _openSidebarSearchTab() {
        if (this._ng_session === undefined) {
            return;
        }
        LayoutStateService.sidebarMax();
        SidebarSessionsService.setActive('search', this._ng_session.getGuid());
    }

    private _onSessionChange(session: ControllerSessionTab | undefined) {
        Object.keys(this._sessionSubscriptions).forEach((prop: string) => {
            this._sessionSubscriptions[prop].unsubscribe();
        });
        if (session === undefined) {
            this._ng_session = undefined;
            this._filtersStorage = undefined;
            this._chartsStorage = undefined;
            this._forceUpdate();
            return;
        }
        this._setActiveSession(session);
        this._forceUpdate();
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
        this._filtersStorage = session.getSessionSearch().getFiltersAPI().getStorage();
        this._chartsStorage = session.getSessionSearch().getChartsAPI().getStorage();
        this._sessionSubscriptions.forceSearch = session.getSessionSearch().getObservable().search.subscribe(this._onForceSearch.bind(this));
        this._loadState();
        this._ng_onSessionChanged.next(this._ng_session);
    }

    private _onForceSearch(request: FilterRequest) {
        if (this._ng_searchRequestId !== undefined) {
            return;
        }
        this._ng_inputCtrl.setValue(request.asDesc().request);
        this._ng_flags = request.asDesc().flags;
        this._addRecentFilter();
        this._search(false);
        this._forceUpdate();
        this._blur();
    }

    private _focus(delay: number = 150) {
        setTimeout(() => {
            if (this._ng_inputComRef === undefined || this._ng_inputComRef === null) {
                return;
            }
            this._ng_inputComRef.focus();
            this._selectTextInInput();
        }, delay);
    }

    private _blur() {
        if (this._ng_requestInputComRef === undefined || this._ng_requestInputComRef === null) {
            return;
        }
        (this._ng_requestInputComRef.nativeElement as HTMLInputElement).blur();
    }

    private _selectTextInInput() {
        setTimeout(() => {
            if (this._ng_requestInputComRef === undefined || this._ng_requestInputComRef === null) {
                return;
            }
            // Select whole content
            const input: HTMLInputElement = (this._ng_requestInputComRef.nativeElement as HTMLInputElement);
            input.setSelectionRange(0, input.value.length);
        });
    }

    private _saveState() {
        if (this._ng_session === undefined) {
            return;
        }
        const scope: ControllerSessionScope = this._ng_session.getScope();
        scope.set<IViewState>(CSettings.viewStateKey, {
            isRequestSaved: this._ng_isRequestSaved,
            isRequestValid: this._ng_isRequestValid,
            request: this._ng_inputCtrl.value,
            prevRequest: this._prevRequest,
            searchRequestId: this._ng_searchRequestId,
            found: this._ng_found,
            read: this._ng_read
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
            this._ng_inputCtrl.setValue('');
            this._prevRequest = '';
            this._ng_searchRequestId = undefined;
            this._ng_read = -1;
            this._ng_found = -1;
        } else {
            this._ng_isRequestSaved = state.isRequestSaved;
            this._ng_isRequestValid = state.isRequestValid;
            this._ng_inputCtrl.setValue(state.request);
            this._prevRequest = state.prevRequest;
            this._ng_searchRequestId = state.searchRequestId;
            this._ng_found = state.found;
            this._ng_read = state.read;
            // Get actual data if active search is present
            if (this._ng_searchRequestId !== undefined) {
                this._ng_searchRequestId = this._ng_session.getSessionSearch().getFiltersAPI().getState().getId();
                if (this._ng_searchRequestId !== undefined) {
                    this._ng_read = this._ng_session.getSessionStream().getOutputStream().getRowsCount();
                    this._ng_found = this._ng_session.getSessionSearch().getOutputStream().getRowsCount();
                } else {
                    this._ng_searchRequestId = undefined;
                    this._ng_read = -1;
                    this._ng_found = -1;
                }
            }
        }
    }

    private _onBeforeTabRemove() {
        this._saveState();
    }

    private _onTitleContextMenu(event: MouseEvent) {
        const items: IMenuItem[] = [
            {
                caption: `Clear recent history`,
                handler: () => {
                    this._clearRecent();
                },
            },
            /*
            { * delimiter * },
            {
                caption: `Keep scrolling with content`,
                handler: () => {
                    // TODO
                },
            }*/
        ];
        ContextMenuService.show({
            items: items,
            x: event.pageX,
            y: event.pageY,
        });
        event.stopImmediatePropagation();
        event.preventDefault();
    }

    private _onStreamUpdated(event: Toolkit.IEventStreamUpdate) {
        if (this._ng_session === undefined) {
            return;
        }
        if (this._ng_session.getGuid() !== event.session) {
            return;
        }
        if (!this._ng_isButtonsVisible()) {
            return;
        }
        this._ng_read = event.rows;
        this._forceUpdate();

    }

    private _onSearchUpdated(event: Toolkit.IEventSearchUpdate) {
        if (this._ng_session === undefined) {
            return;
        }
        if (this._ng_session.getGuid() !== event.session) {
            return;
        }
        if (!this._ng_isButtonsVisible()) {
            return;
        }
        this._ng_found = event.rows;
        // Check state of read
        if (this._ng_read <= 0) {
            this._ng_read = this._ng_session.getSessionStream().getOutputStream().getRowsCount();
        }
        this._forceUpdate();
    }

    private _filterRecentRequest(value: string): string[] {
        if (typeof value !== 'string') {
            return;
        }
        const filted = value.toLowerCase();
        return this._recent.filter((recent: string) => {
            return recent.includes(filted) && recent !== filted;
        });
    }

    private _loadRecentFilters() {
        ElectronIpcService.request(new IPCMessages.SearchRecentRequest(), IPCMessages.SearchRecentResponse).then((response: IPCMessages.SearchRecentResponse) => {
            if (response.error) {
                return this._logger.error(`Fail to parse recent filters due error: ${response.error}`);
            }
            this._recent = response.requests.map((recent: IPCMessages.IRecentSearchRequest) => {
                return recent.request;
            });
            this._ng_inputCtrl.updateValueAndValidity();
        }).catch((error: Error) => {
            return this._logger.error(`Fail to request recent filters due error: ${error.message}`);
        });
    }

    private _addRecentFilter() {
        if (this._ng_inputComRef.value.trim() === '') {
            return;
        }
        ElectronIpcService.request(new IPCMessages.SearchRecentAddRequest({
            request: this._ng_inputComRef.value,
        }), IPCMessages.SearchRecentAddResponse).then((response: IPCMessages.SearchRecentAddResponse) => {
            if (response.error) {
                return this._logger.error(`Fail to add a recent filter due error: ${response.error}`);
            }
            this._loadRecentFilters();
        }).catch((error: Error) => {
            return this._logger.error(`Fail to send a new recent filter due error: ${error.message}`);
        });
    }

    private _forceUpdate() {
        if (this._destroyed) {
            return;
        }
        this._cdRef.detectChanges();
    }

}
