import {
    Component,
    OnDestroy,
    ChangeDetectorRef,
    AfterViewInit,
    ViewChild,
    Input,
    AfterContentInit,
    ElementRef,
    ViewEncapsulation,
} from '@angular/core';
import { Subscription, Subject, Observable } from 'rxjs';
import { ViewSearchOutputComponent } from './output/component';
import { IComponentDesc } from 'chipmunk-client-material';
import { Session } from '../../../controller/session/session';
import { ControllerSessionScope } from '../../../controller/session/dependencies/scope/controller.session.tab.scope';
import {
    FiltersStorage,
    FilterRequest,
} from '../../../controller/session/dependencies/search/dependencies/filters/controller.session.tab.search.filters.storage';
import {
    ChartsStorage,
    ChartRequest,
} from '../../../controller/session/dependencies/search/dependencies/charts/controller.session.tab.search.charts.storage';
import { NotificationsService } from '../../../services.injectable/injectable.service.notifications';
import { rankedNumberAsString } from '../../../controller/helpers/ranks';
import { ControllerToolbarLifecircle } from '../../../controller/controller.toolbar.lifecircle';
import { map, startWith } from 'rxjs/operators';
import { FormControl } from '@angular/forms';
import {
    MatAutocompleteSelectedEvent,
    MatAutocompleteTrigger,
} from '@angular/material/autocomplete';
import { MatInput } from '@angular/material/input';
import { IMenuItem } from '../../../services/standalone/service.contextmenu';
import { IPC } from '../../../services/service.electron.ipc';
import { EChartType } from '../chart/charts/charts';
import { sortPairs, IPair } from '../../../thirdparty/code/engine';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

import TabsSessionsService from '../../../services/service.sessions.tabs';
import HotkeysService from '../../../services/service.hotkeys';
import SidebarSessionsService from '../../../services/service.sessions.sidebar';
import LayoutStateService from '../../../services/standalone/service.layout.state';
import EventsSessionService from '../../../services/standalone/service.events.session';
import ContextMenuService from '../../../services/standalone/service.contextmenu';
import ElectronIpcService from '../../../services/service.electron.ipc';

import * as Toolkit from 'chipmunk.client.toolkit';

export interface ISearchSettings {
    casesensitive: boolean;
    wholeword: boolean;
    regexp: boolean;
}

interface IViewState {
    searchRequestId: string | undefined;
    isRequestValid: boolean;
    request: string;
    read: number;
    found: number;
}

interface IActiveSearchState {
    requestId: string | undefined;
    term: string;
    editing: boolean;
}

const CSettings = {
    viewStateKey: 'search-main-view',
};

@Component({
    selector: 'app-views-search',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
    encapsulation: ViewEncapsulation.None,
})
export class ViewSearchComponent implements OnDestroy, AfterViewInit, AfterContentInit {
    @Input() public injectionIntoTitleBar!: Subject<IComponentDesc | undefined>;
    @Input() public onBeforeTabRemove!: Subject<void>;
    @Input() public setActiveTab!: (guid: string) => void;
    @Input() public getDefaultsTabGuids!: () => { charts: string };
    @Input() public onTitleContextMenu!: Observable<MouseEvent>;
    @Input() public lifecircle!: ControllerToolbarLifecircle;

    @ViewChild('output') _ng_outputComponent!: ViewSearchOutputComponent;
    @ViewChild(MatInput) _ng_inputComRef!: MatInput;
    @ViewChild('requestinput') _ng_requestInputComRef!: ElementRef;
    @ViewChild(MatAutocompleteTrigger) _ng_autoComRef!: MatAutocompleteTrigger;

    public _ng_session: Session | undefined;
    public _ng_isRequestValid: boolean = true;
    public _ng_read: number = -1;
    public _ng_found: number = -1;
    // Out of state (stored in controller)
    public _ng_onSessionChanged: Subject<Session> = new Subject<Session>();
    public _ng_inputCtrl = new FormControl();
    public _ng_recent!: Observable<IPair[]>;
    public _ng_flags: ISearchSettings = {
        casesensitive: false,
        wholeword: false,
        regexp: true,
    };
    public _ng_searchState: IActiveSearchState = {
        requestId: undefined,
        term: '',
        editing: false,
    };

    private _logger: Toolkit.Logger = new Toolkit.Logger('ViewSearchComponent');
    private _subscriptions: { [key: string]: Toolkit.Subscription | Subscription } = {};
    private _sessionSubscriptions: { [key: string]: Subscription } = {};
    private _recent: IPair[] = [];
    private _filtersStorage: FiltersStorage | undefined;
    private _chartsStorage: ChartsStorage | undefined;
    private _destroyed: boolean = false;

    constructor(
        private _cdRef: ChangeDetectorRef,
        private _notifications: NotificationsService,
        private _sanitizer: DomSanitizer,
    ) {
        this._subscriptions.onSessionChange =
            EventsSessionService.getObservable().onSessionChange.subscribe(
                this._onSessionChange.bind(this),
            );
        this._subscriptions.onFocusSearchInput =
            HotkeysService.getObservable().focusSearchInput.subscribe(
                this._onFocusSearchInput.bind(this),
            );
        this._subscriptions.onToolbarToggle =
            HotkeysService.getObservable().toolbarToggle.subscribe(
                this._onToolbarToggle.bind(this),
            );
        this._subscriptions.onStreamUpdated = TabsSessionsService.getSessionEventsHub()
            .subscribe()
            .onStreamUpdated(this._onStreamUpdated.bind(this));
        this._subscriptions.onSearchUpdated = TabsSessionsService.getSessionEventsHub()
            .subscribe()
            .onSearchUpdated(this._onSearchUpdated.bind(this));
        this._setActiveSession();
    }

    ngAfterViewInit() {
        this._loadState();
        this.lifecircle.emit().viewready();
        this._onFocusSearchInput();
    }

    ngAfterContentInit() {
        this._subscriptions.onBeforeTabRemove = this.onBeforeTabRemove
            .asObservable()
            .subscribe(this._onBeforeTabRemove.bind(this));
        this._subscriptions.onTitleContextMenu = this.onTitleContextMenu.subscribe(
            this._onTitleContextMenu.bind(this),
        );
        this._loadRecentFilters();
        this._ng_recent = this._ng_inputCtrl.valueChanges.pipe(
            startWith(''),
            map((value: string) => this._filter(value)),
        );
        this._loadSettings();
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
        return this._ng_searchState.requestId !== undefined;
    }

    public _ng_onKeyDownRequestInput(event: KeyboardEvent): boolean {
        if (
            event.key === 'Backspace' &&
            !this._ng_searchState.editing &&
            this._ng_searchState.term.trim() !== '' &&
            this._ng_inputCtrl.value.trim() === ''
        ) {
            this._ng_inputCtrl.setValue(this._ng_searchState.term);
            this._ng_searchState.editing = true;
            event.preventDefault();
            event.stopImmediatePropagation();
            return false;
        }
        // Need additional event handler for keydown
        // If Tab is clicked focus on input is lost and event cannot be handled
        // That's why it's necessary to check for keydown even instead
        else if (event.key === 'Tab') {
            if (this._ng_autoComRef.activeOption) {
                this._ng_inputCtrl.setValue(this._ng_autoComRef.activeOption.value.description);
            }
            return false;
        }
        return true;
    }

    public _ng_onKeyUpRequestInput(event: KeyboardEvent) {
        if (event.key === 'Escape') {
            if (this._ng_searchState.editing) {
                this._ng_inputCtrl.setValue('');
                this._ng_searchState.editing = false;
                this._forceUpdate();
                return;
            } else if (this._ng_searchState.term !== '' && this._ng_inputCtrl.value.trim() === '') {
                this._ng_onDropRequest(true);
            }
        } else if (event.key === 'Enter') {
            if (this._ng_inputComRef.value.trim() === '') {
                this._ng_onDropRequest(true);
            } else {
                this._validateRegExp();
                this._onStoreFilter();
                this._forceUpdate();
            }
        } else if (event.key === 'Up' || event.key === 'Down') {
            if (
                this._ng_autoComRef !== undefined &&
                this._ng_autoComRef !== null &&
                !this._ng_autoComRef.panelOpen
            ) {
                this._ng_autoComRef.openPanel();
            }
        }
    }

    public _ng_onFocusRequestInput() {
        this._ng_autoComRef.openPanel();
        if (this._ng_inputCtrl.value === '') {
            return;
        }
    }

    public _ng_recentOptionClick() {
        if (this._ng_inputCtrl.value.trim() === '') {
            return;
        }
        this._validateRegExp();
        this._onStoreFilter();
        this._forceUpdate();
        this._focus();
    }

    public _ng_onBlurRequestInput() {
        if (this._ng_searchState.editing) {
            this._ng_searchState.editing = false;
            this._ng_inputCtrl.setValue('');
        }
    }

    public _ng_onAutocompletePanelOpen() {
        if (this._ng_autoComRef === undefined || this._ng_autoComRef === null) {
            return;
        }
        this._ng_autoComRef.updatePosition();
    }

    public _ng_onDropRequest(focus: boolean = false): Promise<string | void> {
        if (this._ng_session === undefined) {
            return Promise.reject(new Error(this._logger.error(`Session object isn't available`)));
        }
        // Drop results
        this._ng_inputCtrl.setValue('');
        this._ng_searchState.requestId = Toolkit.guid();
        this._forceUpdate();
        this._ng_searchState.term = '';
        this._ng_searchState.editing = false;
        return this._ng_session
            .getSessionSearch()
            .getFiltersAPI()
            .drop(this._ng_searchState.requestId)
            .then(() => {
                this._ng_searchState.requestId = undefined;
                this._ng_found = -1;
                this._ng_read = -1;
                this._forceUpdate();
                if (focus) {
                    this._focus(true);
                }
            })
            .catch((droppingError: Error) => {
                this._ng_searchState.requestId = undefined;
                this._forceUpdate();
                return this._notifications.add({
                    caption: 'Search',
                    message: `Cannot drop results due error: ${droppingError.message}.`,
                });
            });
    }

    public _ng_onStoreRequest() {
        this._openSidebarSearchTab();
        const request: FilterRequest | Error = this._getCurrentFilter();
        if (request instanceof Error) {
            return;
        }
        if (this._filtersStorage?.has(request)) {
            return;
        }
        this._filtersStorage?.add(request);
        this._ng_onDropRequest(true);
    }

    public _ng_onStoreChart() {
        this._openSidebarSearchTab();
        const request: ChartRequest | Error = this._getCurrentChart();
        if (request instanceof Error) {
            return;
        }
        if (this._chartsStorage?.has(request)) {
            return;
        }
        if (request instanceof Error) {
            return this._notifications.add({
                caption: 'Chart',
                message: `Not valid regular expression for chart: "${request.message}"`,
            });
        }
        this._chartsStorage?.add(request);
        this._ng_onDropRequest(false).then(() => {
            if (this.setActiveTab === undefined || this.getDefaultsTabGuids === undefined) {
                return;
            }
            this.setActiveTab(this.getDefaultsTabGuids().charts);
        });
        this._addRecentFilter();
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

    public _ng_onRecentSelected(event: MatAutocompleteSelectedEvent) {
        this._ng_inputCtrl.setValue(event.option.viewValue);
    }

    public _ng_flagsToggle(event: MouseEvent, key: 'casesensitive' | 'wholeword' | 'regexp') {
        this._ng_flags[key] = !this._ng_flags[key];
        this._validateRegExp();
        this._forceUpdate();
        if (this._ng_session?.getSessionSearch().getQueue().isLocked()) {
            // Trigger re-search only if it was done already before
            this._search(false);
        }
        (event.target as any).focus();
        event.preventDefault();
        event.stopImmediatePropagation();
        this._saveSettings();
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

    public _ng_getSafeHTML(input: string): SafeHtml {
        return this._sanitizer.bypassSecurityTrustHtml(input);
    }

    public _ng_isValidChart(request: string): boolean {
        return ChartRequest.isValid(request);
    }

    public _ng_clickActiveSearchHolder(event: MouseEvent) {
        event.stopPropagation();
    }

    public _ng_canSaveFilter(): boolean {
        const filter: Error | FilterRequest = this._getCurrentFilter();
        if (filter instanceof Error || this._filtersStorage === undefined) {
            return false;
        }
        return !this._filtersStorage.has(filter);
    }

    public _ng_canSaveChart(): boolean {
        const chart: Error | ChartRequest = this._getCurrentChart();
        if (
            chart instanceof Error ||
            this._chartsStorage === undefined ||
            !this._ng_isValidChart(chart.asDesc().request)
        ) {
            return false;
        }
        return !this._chartsStorage.has(chart);
    }

    private _isSearchActive(): boolean {
        if (this._ng_session === undefined) {
            return false;
        }
        if (this._ng_searchState.term !== '') {
            this._ng_session.getSessionSearch().getQueue().lock();
            return true;
        } else {
            this._ng_session.getSessionSearch().getQueue().unlock();
            return false;
        }
    }

    private _onStoreFilter() {
        if (this._ng_inputCtrl.value === undefined || this._ng_inputCtrl.value.trim() === '') {
            return;
        }
        if (!this._ng_isRequestValid) {
            return this._notifications.add({
                caption: 'Search',
                message: `Regular expresion isn't valid. Please correct it.`,
            });
        }
        this._ng_searchState.term = this._ng_inputCtrl.value;
        this._ng_searchState.editing = false;
        this._ng_inputCtrl.setValue('');
        this._ng_autoComRef.closePanel();
        this._addRecentFilter();
        this._search();
    }

    private _getCurrentFilter(): FilterRequest | Error {
        try {
            return new FilterRequest({
                request: this._ng_searchState.term,
                flags: Object.assign({}, this._ng_flags),
            });
        } catch (err) {
            return err instanceof Error ? err : new Error(this._logger.warn(`Error: ${err}`));
        }
    }

    private _getCurrentChart(): ChartRequest | Error {
        try {
            return new ChartRequest({
                request: this._ng_searchState.term,
                type: EChartType.smooth,
            });
        } catch (err) {
            return err instanceof Error ? err : new Error(this._logger.warn(`Error: ${err}`));
        }
    }

    private _clearRecent() {
        this._ng_autoComRef.closePanel();
        this._ng_inputCtrl.updateValueAndValidity();
        ElectronIpcService.request<IPC.SearchRecentClearResponse>(
            new IPC.SearchRecentClearRequest(),
            IPC.SearchRecentClearResponse,
        )
            .then((response) => {
                this._loadRecentFilters();
                if (response.error) {
                    this._logger.error(`Fail to reset recent filters due error: ${response.error}`);
                }
            })
            .catch((error: Error) => {
                return this._logger.error(
                    `Fail send request to reset recent filters due error: ${error.message}`,
                );
            });
    }

    private _search(focus: boolean = true) {
        const session = this._ng_session;
        if (session === undefined) {
            this._logger.error(`Session controller isn't available`);
            return;
        }
        const request: FilterRequest | Error = this._getCurrentFilter();
        if (request instanceof Error) {
            return this._notifications.add({
                caption: 'Search',
                message: `Regular expresion isn't valid. Please correct it.`,
            });
        }
        this._ng_searchState.requestId = Toolkit.guid();
        session
            .getSessionSearch()
            .getFiltersAPI()
            .search(this._ng_searchState.requestId, request)
            .then((count: number | undefined) => {
                if (count === undefined) {
                    this._logger.error(
                        `Cannot procceed search as soon as stream length is unknown`,
                    );
                    return;
                }
                this._onSearchUpdated({ session: session.getGuid(), rows: count });
                // Search done
                this._ng_searchState.requestId = undefined;
                if (focus) {
                    this._focus(true);
                }
                this._forceUpdate();
            })
            .catch((searchError: Error) => {
                this._ng_searchState.requestId = undefined;
                this._forceUpdate();
                return this._notifications.add({
                    caption: 'Search',
                    message: `Cannot to do a search due error: ${searchError.message}.`,
                });
            });
        this._forceUpdate();
    }

    private _onFocusSearchInput() {
        const doc_sel = document.getSelection();
        if (doc_sel === null) {
            return;
        }
        const selection: string = doc_sel.toString();
        if (
            selection.trim() === '' ||
            selection.search(/[\n\r]/gi) !== -1 ||
            selection.length > 100
        ) {
            this._focus(true);
        } else {
            try {
                const request: FilterRequest = new FilterRequest({
                    request: selection,
                    flags: { casesensitive: true, wholeword: true, regexp: false },
                });
                doc_sel.removeAllRanges();
                this._onForceSearch(request);
            } catch (err) {
                this._logger.error(`Error on focus: ${err instanceof Error ? err.message : err}`);
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

    private _onSessionChange(session: Session | undefined) {
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

    private _setActiveSession(session?: Session) {
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
        this._sessionSubscriptions.forceSearch = session
            .getSessionSearch()
            .getObservable()
            .search.subscribe(this._onForceSearch.bind(this));
        this._loadState();
        this._ng_onSessionChanged.next(this._ng_session);
    }

    private _onForceSearch(request: FilterRequest) {
        if (this._ng_searchState.requestId !== undefined) {
            return;
        }
        this._ng_searchState.term = request.asDesc().request;
        this._ng_flags = request.asDesc().flags;
        this._addRecentFilter();
        this._search(false);
        this._forceUpdate();
        this._blur();
    }

    private _focus(hidePanel: boolean = false) {
        if (this._ng_inputComRef === undefined || this._ng_inputComRef === null) {
            return;
        }
        this._ng_inputComRef.focus();
        if (hidePanel && this._ng_autoComRef !== undefined && this._ng_autoComRef !== null) {
            this._ng_autoComRef.closePanel();
        }
        // Select text in input
        setTimeout(() => {
            if (this._ng_requestInputComRef === undefined || this._ng_requestInputComRef === null) {
                return;
            }
            // Select whole content
            const input: HTMLInputElement = this._ng_requestInputComRef
                .nativeElement as HTMLInputElement;
            input.setSelectionRange(0, input.value.length);
        });
    }

    private _blur() {
        if (this._ng_requestInputComRef === undefined || this._ng_requestInputComRef === null) {
            return;
        }
        (this._ng_requestInputComRef.nativeElement as HTMLInputElement).blur();
    }

    private _saveState() {
        if (this._ng_session === undefined) {
            return;
        }
        const scope: ControllerSessionScope = this._ng_session.getScope();
        scope.set<IViewState>(CSettings.viewStateKey, {
            isRequestValid: this._ng_isRequestValid,
            request: this._ng_searchState.term,
            searchRequestId: this._ng_searchState.requestId,
            found: this._ng_found,
            read: this._ng_read,
        });
    }

    private _loadState() {
        if (this._ng_session === undefined) {
            return;
        }
        const scope: ControllerSessionScope = this._ng_session.getScope();
        const state: IViewState | undefined = scope.get<IViewState>(CSettings.viewStateKey);
        if (state === undefined) {
            this._ng_isRequestValid = true;
            this._ng_inputCtrl.setValue('');
            this._ng_searchState.term = '';
            this._ng_searchState.requestId = undefined;
            this._ng_searchState.editing = false;
            this._ng_read = -1;
            this._ng_found = -1;
        } else {
            this._ng_isRequestValid = state.isRequestValid;
            this._ng_inputCtrl.setValue('');
            this._ng_searchState.term = state.request;
            this._ng_searchState.requestId = state.searchRequestId;
            this._ng_searchState.editing = false;
            this._ng_found = state.found;
            this._ng_read = state.read;
            // Get actual data if active search is present
            if (this._ng_searchState.requestId !== undefined) {
                this._ng_searchState.requestId = this._ng_session
                    .getSessionSearch()
                    .getQueue()
                    .getId();
                if (this._ng_searchState.requestId !== undefined) {
                    this._ng_read = this._ng_session.getStreamOutput().getRowsCount();
                    this._ng_found = this._ng_session
                        .getSessionSearch()
                        .getOutputStream()
                        .getRowsCount();
                } else {
                    this._ng_searchState.requestId = undefined;
                    this._ng_read = -1;
                    this._ng_found = -1;
                }
            }
        }
        this._validateRegExp();
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
        if (!this._isSearchActive()) {
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
        if (!this._isSearchActive()) {
            return;
        }
        this._ng_found = event.rows;
        // Check state of read
        if (this._ng_read <= 0) {
            this._ng_read = this._ng_session.getStreamOutput().getRowsCount();
        }
        this._forceUpdate();
    }

    private _filter(value: string): IPair[] {
        if (typeof value !== 'string') {
            return [];
        }
        const scored = sortPairs(this._recent, value, value !== '', 'span');
        return scored;
    }

    private _loadRecentFilters() {
        ElectronIpcService.request<IPC.SearchRecentResponse>(
            new IPC.SearchRecentRequest(),
            IPC.SearchRecentResponse,
        )
            .then((response) => {
                if (response.error) {
                    this._logger.error(`Fail to parse recent filters due error: ${response.error}`);
                    return;
                }
                this._recent = response.requests.map((recent: IPC.IRecentSearchRequest) => {
                    return {
                        id: '',
                        caption: ' ',
                        description: recent.request,
                        tcaption: ' ',
                        tdescription: recent.request,
                    };
                });
                this._ng_inputCtrl.updateValueAndValidity();
            })
            .catch((error: Error) => {
                return this._logger.error(
                    `Fail to request recent filters due error: ${error.message}`,
                );
            });
    }

    private _addRecentFilter() {
        if (this._ng_searchState.term.trim() === '') {
            return;
        }
        ElectronIpcService.request<IPC.SearchRecentAddResponse>(
            new IPC.SearchRecentAddRequest({
                request: this._ng_searchState.term,
            }),
            IPC.SearchRecentAddResponse,
        )
            .then((response) => {
                if (response.error) {
                    this._logger.error(`Fail to add a recent filter due error: ${response.error}`);
                    return;
                }
                this._loadRecentFilters();
            })
            .catch((error: Error) => {
                return this._logger.error(
                    `Fail to send a new recent filter due error: ${error.message}`,
                );
            });
    }

    private _loadSettings() {
        if (this._ng_session === undefined) {
            return;
        }
        const settings = TabsSessionsService.getSearchSettings(this._ng_session.getGuid());
        if (settings !== undefined) {
            this._ng_flags = settings;
        }
    }

    private _saveSettings() {
        if (this._ng_session === undefined) {
            return;
        }
        TabsSessionsService.setSearchSettings(this._ng_session.getGuid(), this._ng_flags);
    }

    private _validateRegExp() {
        this._ng_isRequestValid = this._ng_flags.regexp
            ? Toolkit.regTools.isRegStrValid(this._ng_inputCtrl.value)
            : true;
    }

    private _forceUpdate() {
        if (this._destroyed) {
            return;
        }
        this._cdRef.detectChanges();
    }
}
