import { Component, OnDestroy, ChangeDetectorRef, AfterContentInit, ViewChild, AfterViewInit, Input, ElementRef } from '@angular/core';
import * as Toolkit from 'chipmunk.client.toolkit';
import { Subscription, Subject } from 'rxjs';
import SessionsService from '../../../../services/service.sessions.tabs';
import SidebarSessionsService from '../../../../services/service.sessions.sidebar';
import SearchSessionsService, { IRequest, IChartRequest } from '../../../../services/service.sessions.search';
import { IRequestItem } from './request/component';
import { IChartItem } from './chartentry/component';
import { IRequestItem as IRequestDetailsItem } from './detailsrequest/component';
import { IChartItem as IChartDetailsItem } from './detailschart/component';
import { NotificationsService } from '../../../../services.injectable/injectable.service.notifications';
import { SidebarAppSearchManagerControlsComponent } from './controls/component';
import { ControllerSessionTab } from '../../../../controller/controller.session.tab';
import ContextMenuService, { IMenu, IMenuItem } from '../../../../services/standalone/service.contextmenu';

interface IState {
    _ng_selectedRequestIndex: number;
    _ng_filename: string | undefined;
    _filename: string | undefined;
    _changed: boolean;
}

enum EEntityType {
    filters = 'filters',
    charts = 'charts',
}

@Component({
    selector: 'app-sidebar-app-search-requests',
    templateUrl: './template.html',
    styleUrls: ['./styles.less']
})

export class SidebarAppSearchRequestsComponent implements OnDestroy, AfterContentInit, AfterViewInit {

    public static StateKey = 'sidebar-app-search-requests';

    @ViewChild('listrequests', {static: false}) _listRequestsElmRef: ElementRef;
    @ViewChild('listcharts', {static: false}) _listChartsElmRef: ElementRef;

    public _ng_requests: IRequestItem[] = [];
    public _ng_charts: IChartItem[] = [];
    public _ng_selectedRequest: IRequestDetailsItem | undefined;
    public _ng_selectedRequestIndex: number = -1;
    public _ng_selectedChart: IChartDetailsItem | undefined;
    public _ng_selectedChartIndex: number = -1;
    public _ng_filename: string | undefined;

    private _subscriptions: { [key: string]: Subscription | undefined } = { };
    private _logger: Toolkit.Logger = new Toolkit.Logger('SidebarAppSearchRequestsComponent');
    private _destroyed: boolean = false;
    private _session: ControllerSessionTab | undefined;
    private _focused: EEntityType | undefined;
    private _filename: string | undefined;
    private _changed: boolean = false;
    private _subjectsRequests: {
        onEdit: Subject<IRequest>,
        onEditCancel: Subject<void>,
        onFileReset: Subject<void>,
        onChanges: Subject<void>,
    } = {
        onEdit: new Subject<IRequest>(),
        onEditCancel: new Subject<void>(),
        onFileReset: new Subject<void>(),
        onChanges: new Subject<void>(),
    };
    private _subjectsCharts: {
        onEdit: Subject<IChartRequest>,
        onEditCancel: Subject<void>,
        onFileReset: Subject<void>,
        onChanges: Subject<void>,
    } = {
        onEdit: new Subject<IChartRequest>(),
        onEditCancel: new Subject<void>(),
        onFileReset: new Subject<void>(),
        onChanges: new Subject<void>(),
    };

    constructor(private _cdRef: ChangeDetectorRef,
                private _notifications: NotificationsService) {
        this._subscriptions.onRequestsUpdated = SearchSessionsService.getObservable().onRequestsUpdated.subscribe(this._onRequestsUpdated.bind(this));
        this._subscriptions.onChartsUpdated = SearchSessionsService.getObservable().onChartsUpdated.subscribe(this._onChartsUpdated.bind(this));
        this._subscriptions.onSessionChange = SessionsService.getObservable().onSessionChange.subscribe(this._onSessionChange.bind(this));
        this._onKeyPress = this._onKeyPress.bind(this);
        this._session = SessionsService.getActive();
        this._ng_requests = this._getRequestItems(this._session.getSessionSearch().getFiltersAPI().getStored());
        this._ng_charts = this._getChartsItems(this._session.getSessionSearch().getChartsAPI().getStored());
    }

    public ngOnDestroy() {
        this._destroyed = true;
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
        });
        window.removeEventListener('keyup', this._onKeyPress);
    }

    public ngAfterContentInit() {
        const session: ControllerSessionTab = SessionsService.getActive();
        if (session === undefined) {
            return;
        }
        this._subscriptions.onSearchProcessing = session.getSessionSearch().getFiltersAPI().getObservable().onSearchProcessing.subscribe(this._onSearchProcessing.bind(this));
    }

    public ngAfterViewInit() {
        this._loadState();
        window.addEventListener('keyup', this._onKeyPress);
        SidebarSessionsService.setTitleInjection({
            factory: SidebarAppSearchManagerControlsComponent,
            resolved: false,
            inputs: {
                setCurrentFilename: this._setCurrentFileName.bind(this),
                onFileReset: this._subjectsRequests.onFileReset.asObservable(),
                onChanges: this._subjectsRequests.onChanges.asObservable(),
                dropChangesFlag: () => {
                    this._changed = false;
                    this._saveState();
                },
                filename: this._filename,
                changed: this._changed,
            }
        });
    }

    public _ng_onRemoveAll() {
        this._session.getSessionSearch().getFiltersAPI().removeAllStored();
        this._subjectsRequests.onFileReset.next();
        this._ng_filename = undefined;
        this._filename = undefined;
        this._forceUpdate();
    }

    public _ng_onRequestsFocus() {
        this._focused = EEntityType.filters;
    }

    public _ng_onRequestsBlur() {
        this._focused = undefined;
    }

    public _ng_onChartsFocus() {
        this._focused = EEntityType.charts;
    }

    public _ng_onChartsBlur() {
        this._focused = undefined;
    }

    public _ng_onContexMenu(event: MouseEvent, request: IRequestItem | IChartItem, type: EEntityType) {
        if (request === undefined) {
            return;
        }
        const items: IMenuItem[] = [];
        items.push(...[
            {
                caption: `Edit`,
                handler: () => {
                    if (type === EEntityType.filters) {

                    } else {

                    }
                    this._subjectsRequests.onEdit.next((request as IRequestItem).request);
                },
            },
            { /* delimiter */ },
            {
                caption: request.request.active ? `Deactivate` : `Activate`,
                handler: () => {
                    if (type === EEntityType.filters) {
                        this._onChangeStateRequest((request as IRequestItem).request, !request.request.active);
                    } else {
                        this._onChangeStateChart((request as IChartItem).request, !request.request.active);
                    }
                },
            },
            { /* delimiter */ },
            {
                caption: `Deactivate all`,
                handler: () => {
                    if (type === EEntityType.filters) {
                        this._toggleAllExcept(undefined, true);
                    } else {
                        //
                    }
                },
            },
            {
                caption: `Activate all`,
                handler: () => {
                    if (type === EEntityType.filters) {
                        this._toggleAllExcept(undefined, false);
                    } else {
                        //
                    }
                },
            },
            {
                caption: `Deactivate all except this`,
                handler: () => {
                    if (type === EEntityType.filters) {
                        this._toggleAllExcept(request.request.reg.source, true);
                    } else {
                        //
                    }
                },
            },
            {
                caption: `Activate all except this`,
                handler: () => {
                    if (type === EEntityType.filters) {
                        this._toggleAllExcept(request.request.reg.source, false);
                    } else {
                        //
                    }
                },
            },
            { /* delimiter */ },
            {
                caption: `Remove`,
                handler: () => {
                    if (type === EEntityType.filters) {
                        this._onRemoveRequest((request as IRequestItem).request);
                    } else {
                        this._onRemoveChart((request as IChartItem).request);
                    }
                },
            },
            {
                caption: `Remove All`,
                handler: () => {
                    if (type === EEntityType.filters) {
                        this._ng_onRemoveAll();
                    } else {
                        //
                    }
                },
            },
        ]);
        ContextMenuService.show({
            items: items,
            x: event.pageX,
            y: event.pageY,
        });
    }

    private _setCurrentFileName(filename: string) {
        this._ng_filename = Toolkit.basename(filename);
        this._filename = filename;
        this._saveState();
        this._cdRef.detectChanges();
    }

    private _onKeyPress(event: KeyboardEvent) {
        if (this._focused === undefined) {
            return;
        }
        switch (this._focused) {
            case EEntityType.filters:
                if (this._ng_requests.length === 0) {
                    return;
                }
                switch (event.key) {
                    case 'ArrowDown':
                        if (this._ng_selectedRequestIndex === -1 || this._ng_selectedRequestIndex === this._ng_requests.length - 1) {
                            this._selectRequestByIndex(0);
                        } else {
                            this._selectRequestByIndex(this._ng_selectedRequestIndex + 1);
                        }
                        break;
                    case 'ArrowUp':
                        if (this._ng_selectedRequestIndex === -1 || this._ng_selectedRequestIndex === 0) {
                            this._selectRequestByIndex(this._ng_requests.length - 1);
                        } else {
                            this._selectRequestByIndex(this._ng_selectedRequestIndex - 1);
                        }
                        break;
                    case 'Enter':
                        if (this._ng_selectedRequestIndex !== -1) {
                            this._subjectsRequests.onEdit.next(this._ng_selectedRequest.request);
                        }
                        break;
                }
                break;
            case EEntityType.charts:
                if (this._ng_charts.length === 0) {
                    return;
                }
                switch (event.key) {
                    case 'ArrowDown':
                        if (this._ng_selectedChartIndex === -1 || this._ng_selectedChartIndex === this._ng_charts.length - 1) {
                            this._selectChartByIndex(0);
                        } else {
                            this._selectChartByIndex(this._ng_selectedChartIndex + 1);
                        }
                        break;
                    case 'ArrowUp':
                        if (this._ng_selectedChartIndex === -1 || this._ng_selectedChartIndex === 0) {
                            this._selectChartByIndex(this._ng_charts.length - 1);
                        } else {
                            this._selectChartByIndex(this._ng_selectedChartIndex - 1);
                        }
                        break;
                    case 'Enter':
                        if (this._ng_selectedChartIndex !== -1) {
                            this._subjectsCharts.onEdit.next(this._ng_selectedChart.request);
                        }
                        break;
                }
                break;
        }
    }

    private _getStateGuid(): string | undefined {
        if (this._session === undefined) {
            return;
        }
        return `${SidebarAppSearchRequestsComponent.StateKey}:${this._session.getGuid()}`;
    }

    private _loadState(): void {
        if (this._session === undefined) {
            return;
        }
        const key: string | undefined = this._getStateGuid();
        this._session.getSessionsStates().applyStateTo(key, this);
        this._selectRequestByIndex(this._ng_selectedRequestIndex);
        this._forceUpdate();
    }

    private _saveState(): void {
        if (this._session === undefined || this._ng_requests.length === 0) {
            return;
        }
        const key: string | undefined = this._getStateGuid();
        this._session.getSessionsStates().set<IState>(
            key,
            {
                _ng_selectedRequestIndex: this._ng_selectedRequestIndex,
                _ng_filename: this._ng_filename,
                _filename: this._filename,
                _changed: this._changed,
            }
        );
    }

    private _onRequestsUpdated(requests: IRequest[]) {
        const session = SessionsService.getActive();
        if (session === undefined || this._session === undefined) {
            return;
        }
        if (session.getGuid() !== this._session.getGuid()) {
            return;
        }
        const newRequest: IRequest | undefined = this._getNewRequest(requests);
        this._ng_requests = this._getRequestItems(requests);
        if (newRequest === undefined) {
            if (this._ng_requests.length === 0) {
                this._ng_selectedRequest = undefined;
                this._ng_selectedRequestIndex = -1;
            }
            this._forceUpdate();
        } else {
            this._onSelectRequest(newRequest);
        }
    }

    private _onChartsUpdated(charts: IChartRequest[]) {
        const session = SessionsService.getActive();
        if (session === undefined || this._session === undefined) {
            return;
        }
        if (session.getGuid() !== this._session.getGuid()) {
            return;
        }
        const newChart: IChartRequest | undefined = this._getNewChart(charts);
        this._ng_charts = this._getChartsItems(charts);
        if (newChart === undefined) {
            if (this._ng_charts.length === 0) {
                this._ng_selectedChart = undefined;
                this._ng_selectedChartIndex = -1;
            }
            this._forceUpdate();
        } else {
            this._onSelectChart(newChart);
        }
    }

    private _onSearchProcessing() {
        this._ng_selectedRequest = undefined;
        this._ng_selectedRequestIndex = -1;
        this._forceUpdate();
    }

    private _getRequestItems(requests: IRequest[]): IRequestItem[] {
        return requests.map((request: IRequest, index: number) => {
            return {
                request: request,
                onEdit: this._subjectsRequests.onEdit.asObservable(),
                onEditCancel: this._subjectsRequests.onEditCancel.asObservable(),
                onSelect: this._onSelectRequest.bind(this, request),
                onChangeState: this._onChangeStateRequest.bind(this, request),
                onEditDone: this._onRequestValueChanged.bind(this, request),
            };
        });
    }

    private _getChartsItems(charts: IChartRequest[]): IChartItem[] {
        return charts.map((chart: IChartRequest, index: number) => {
            return {
                request: chart,
                onEdit: this._subjectsCharts.onEdit.asObservable(),
                onEditCancel: this._subjectsCharts.onEditCancel.asObservable(),
                onSelect: this._onSelectChart.bind(this, chart),
                onChangeState: this._onChangeStateChart.bind(this, chart),
                onEditDone: this._onChartValueChanged.bind(this, chart),
            };
        });
    }

    private _focus() {
        if (this._listRequestsElmRef === undefined) {
            return;
        }
        this._listRequestsElmRef.nativeElement.focus();
    }

    private _getNewRequest(requests: IRequest[]): IRequest | undefined {
        let result: IRequest | undefined;
        requests.forEach((request: IRequest) => {
            let exist: boolean = false;
            this._ng_requests.forEach((stored: IRequestItem) => {
                if (stored.request.reg.source === request.reg.source) {
                    exist = true;
                }
            });
            if (!exist) {
                result = request;
            }
        });
        this._subjectsRequests.onChanges.next();
        return result;
    }

    private _getNewChart(charts: IChartRequest[]): IChartRequest | undefined {
        let result: IChartRequest | undefined;
        charts.forEach((request: IChartRequest) => {
            let exist: boolean = false;
            this._ng_charts.forEach((stored: IChartItem) => {
                if (stored.request.reg.source === request.reg.source) {
                    exist = true;
                }
            });
            if (!exist) {
                result = request;
            }
        });
        this._subjectsRequests.onChanges.next();
        return result;
    }


    private _onRequestValueChanged(request: IRequest, value?: string) {
        this._subjectsRequests.onEditCancel.next();
        this._focus();
        if (value === undefined) {
            return;
        }
        this._session.getSessionSearch().getFiltersAPI().updateStored(request.reg.source, { reguest: value });
        this._subjectsRequests.onChanges.next();
        this._changed = true;
        this._saveState();
    }

    private _onSelectRequest(request: IRequest) {
        if (this._ng_selectedRequest !== undefined && this._ng_selectedRequest.request.reg.source === request.reg.source) {
            return;
        }
        this._selectRequestByIndex(this._getIndexOfRequest(request));
    }

    private _onRemoveRequest(request: IRequest) {
        this._session.getSessionSearch().getFiltersAPI().removeStored(request.reg.source);
        this._subjectsRequests.onChanges.next();
    }

    private _onChangeStateRequest(request: IRequest, active: boolean) {
        this._session.getSessionSearch().getFiltersAPI().updateStored(request.reg.source, { active: active });
        this._subjectsRequests.onChanges.next();
        this._forceUpdate();
    }

    private _onSelectChart(chart: IChartRequest) {
        if (this._ng_selectedChart !== undefined && this._ng_selectedChart.request.reg.source === chart.reg.source) {
            return;
        }
        this._selectChartByIndex(this._getIndexOfChart(chart));
    }

    private _onRemoveChart(request: IChartRequest) {
        this._session.getSessionSearch().getChartsAPI().removeStored(request.reg.source);
        this._subjectsRequests.onChanges.next();
    }

    private _onChangeStateChart(request: IChartRequest, active: boolean) {
        this._session.getSessionSearch().getChartsAPI().updateStored(request.reg.source, { active: active });
        this._subjectsRequests.onChanges.next();
        this._forceUpdate();
    }


    private _onChartValueChanged(request: IChartRequest, value?: string) {
        this._subjectsRequests.onEditCancel.next();
        this._focus();
        if (value === undefined) {
            return;
        }
        this._session.getSessionSearch().getChartsAPI().updateStored(request.reg.source, { reguest: value });
        this._subjectsRequests.onChanges.next();
        this._changed = true;
        this._saveState();
    }

    private _onRequestColorChanged(request: IRequest, color: string, background: string) {
        this._session.getSessionSearch().getFiltersAPI().updateStored(request.reg.source, { color: color, background: background });
        this._subjectsRequests.onChanges.next();
    }

    private _onChartColorChanged(request: IChartRequest, color: string) {
        this._session.getSessionSearch().getChartsAPI().updateStored(request.reg.source, { color: color });
        this._subjectsRequests.onChanges.next();
    }

    private _selectRequestByIndex(index: number) {
        if (this._ng_requests[index] === undefined) {
            return;
        }
        this._ng_selectedChart = undefined;
        this._ng_selectedChartIndex = -1;
        this._ng_selectedRequest = {
            request: this._ng_requests[index].request,
            onChange: this._onRequestColorChanged.bind(this, this._ng_requests[index].request),
        };
        this._ng_selectedRequestIndex = index;
        this._saveState();
        this._forceUpdate();
    }

    private _selectChartByIndex(index: number) {
        if (this._ng_charts[index] === undefined) {
            return;
        }
        this._ng_selectedRequest = undefined;
        this._ng_selectedRequestIndex = -1;
        this._ng_selectedChart = {
            request: this._ng_charts[index].request,
            onChange: this._onChartColorChanged.bind(this, this._ng_charts[index].request),
        };
        this._ng_selectedChartIndex = index;
        this._saveState();
        this._forceUpdate();
    }

    private _getIndexOfRequest(request: IRequest) {
        let index: number = -1;
        this._ng_requests.forEach((item: IRequestItem, i: number) => {
            if (item.request.reg.source === request.reg.source) {
                index = i;
            }
        });
        return index;
    }

    private _getIndexOfChart(request: IChartRequest) {
        let index: number = -1;
        this._ng_charts.forEach((item: IChartItem, i: number) => {
            if (item.request.reg.source === request.reg.source) {
                index = i;
            }
        });
        return index;
    }

    private _onSessionChange(controller: ControllerSessionTab) {
        if (controller === undefined) {
            return;
        }
        this._session = controller;
        this._onRequestsUpdated(this._session.getSessionSearch().getFiltersAPI().getStored());
        this._onChartsUpdated(this._session.getSessionSearch().getChartsAPI().getStored());
    }

    private _toggleAllExcept(source: string | undefined, targetState: boolean) {
        const requests: IRequest[] = this._ng_requests.map((item: IRequestItem) => {
            item.request.active = item.request.reg.source === source ? targetState : !targetState;
            return Object.assign({}, item.request);
        });
        this._session.getSessionSearch().getFiltersAPI().overwriteStored(requests);
    }

    private _forceUpdate() {
        if (this._destroyed) {
            return;
        }
        this._cdRef.detectChanges();
    }
}
