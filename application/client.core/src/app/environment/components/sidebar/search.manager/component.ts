import { Component, OnDestroy, ChangeDetectorRef, AfterViewInit, HostBinding, HostListener, ElementRef } from '@angular/core';
import { Subject, Observable, Subscription } from 'rxjs';
import { CdkDragDrop } from '@angular/cdk/drag-drop';
import { ControllerSessionTab } from '../../../controller/controller.session.tab';
import { IFiltersStorageUpdated, FilterRequest } from 'src/app/environment/controller/controller.session.tab.search.filters.storage';
import { IChartsStorageUpdated, ChartRequest } from 'src/app/environment/controller/controller.session.tab.search.charts.storage';
import { EChartType } from '../../views/chart/charts/charts';
import { NotificationsService } from '../../../services.injectable/injectable.service.notifications';
import { IMenuItem } from '../../../services/standalone/service.contextmenu';

import ContextMenuService from '../../../services/standalone/service.contextmenu';
import TabsSessionsService from '../../../services/service.sessions.tabs';
import EventsSessionService from '../../../services/standalone/service.events.session';

import * as Toolkit from 'chipmunk.client.toolkit';

export interface IRequestEvent {
    event: MouseEvent;
    request: FilterRequest | ChartRequest;
    index: number;
}

export interface IReorderEvent {
    ddEvent: CdkDragDrop<Array<ChartRequest | FilterRequest>>;
    target: 'filters' | 'charts';
}

@Component({
    selector: 'app-sidebar-app-searchmanager',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})

export class SidebarAppSearchManagerComponent implements OnDestroy, AfterViewInit {

    public _ng_observables: {
        select: Observable<number>,
        edit: Observable<FilterRequest | ChartRequest | undefined>,
    };
    public _ng_reorder: Subject<IReorderEvent> = new Subject<IReorderEvent>();
    public _ng_filters: FilterRequest[] = [];
    public _ng_charts: ChartRequest[] = [];
    public _ng_selected: Subject<string> = new Subject<string>();
    public _ng_filter: FilterRequest | undefined;
    public _ng_chart: ChartRequest | undefined;
    public _ng_filename: string = '';

    private _subjects: {
        select: Subject<number>,
        edit: Subject<FilterRequest | ChartRequest | undefined>,
    } = {
        select: new Subject<number>(),
        edit: new Subject<FilterRequest | ChartRequest | undefined>(),
    };
    private _session: ControllerSessionTab | undefined;
    private _selected: number = -1;
    private _focused: boolean = false;
    private _subscriptions: { [key: string]: Subscription } = {};
    private _sessionSubscriptions: { [key: string]: Subscription } = {};
    private _destroyed: boolean = false;
    private _click: number = 0;

    @HostBinding('attr.tabindex') get tabindex() { return 0; }
    @HostListener('focus', ['$event.target']) onFocus() {
        this._focused = true;
    }
    @HostListener('blur', ['$event.target']) onBlur() {
        this._focused = false;
    }
    @HostListener('contextmenu', ['$event']) onContextMenu(event: MouseEvent) {
        const items: IMenuItem[] = [
            {
                caption: 'Remove All',
                handler: () => {
                    if (this._session === undefined) {
                        return;
                    }
                    // Drop filters file if it wqs definened
                    this._session.getSessionSearch().getRecentAPI().setCurrentFile('');
                    // Clean all
                    this._removeFromList('filters', undefined);
                    this._removeFromList('charts', undefined);
                },
            },
            { /* delimiter */ },
            {
                caption: `Clear recent history`,
                handler: () => {
                    this._session.getSessionSearch().getRecentAPI().clear().catch((error: Error) => {
                        this._notifications.add({
                            caption: 'Error',
                            message: `Fail to drop recent filters history due error: ${error.message}`
                        });
                    });
                },
            },
        ];
        ContextMenuService.show({
            items: items,
            x: event.pageX,
            y: event.pageY,
        });
        event.stopImmediatePropagation();
        event.preventDefault();
    }

    constructor(
        private _cdRef: ChangeDetectorRef,
        private _self: ElementRef,
        private _notifications: NotificationsService,
    ) {
        this._ng_observables = {
            select: this._subjects.select.asObservable(),
            edit: this._subjects.edit.asObservable(),
        };
        this._onGlobalKeyUp = this._onGlobalKeyUp.bind(this);
        this._subscriptions.reorder = this._ng_reorder.asObservable().subscribe(this._onReorderList.bind(this));
        this._subscriptions.selected = this._ng_selected.asObservable().subscribe(this._onSelectedInList.bind(this));
    }

    public ngOnDestroy() {
        this._destroyed = true;
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
        });
        Object.keys(this._sessionSubscriptions).forEach((prop: string) => {
            this._sessionSubscriptions[prop].unsubscribe();
        });
        window.removeEventListener('keyup', this._onGlobalKeyUp);
        if (this._session !== undefined) {
            this._session.getSessionSearch().getChartsAPI().selectBySource(undefined);
        }
    }

    public ngAfterViewInit() {
        window.addEventListener('keyup', this._onGlobalKeyUp);
        this._subscriptions.onSessionChange = EventsSessionService.getObservable().onSessionChange.subscribe(this._onSessionChange.bind(this));
        this._setActiveSession();
    }

    public _ng_onPanelClick() {
        this._forceUpdate();
    }

    public _ng_onDoubleClick(target: 'filters' | 'charts', event: IRequestEvent) {
        if (this._session === undefined) {
            return;
        }
        const request: FilterRequest = target === 'filters' ? event.request as FilterRequest : new FilterRequest({
            request: event.request.asDesc().request,
            flags: event.request.asDesc().flags,
        });
        this._session.getSessionSearch().search(request);
    }

    public _ng_onContextListsMenu(target: 'filters' | 'charts', event: IRequestEvent) {
        const items: IMenuItem[] = [
            {
                caption: 'Edit',
                handler: () => {
                    this._subjects.edit.next(event.request);
                },
            },
            { /* delimiter */ },
            {
                caption: `Show matches`,
                handler: () => {
                    if (this._session === undefined) {
                        return;
                    }
                    const request: FilterRequest = target === 'filters' ? event.request as FilterRequest : new FilterRequest({
                        request: event.request.asDesc().request,
                        flags: event.request.asDesc().flags,
                    });
                    this._session.getSessionSearch().search(request);
                },
            },
            { /* delimiter */ },
            {
                caption: event.request.getState() ? 'Deactivate' : 'Activate',
                handler: () => {
                    event.request.setState(!event.request.getState());
                    this._forceUpdate();
                },
            },
            { /* delimiter */ },
            {
                caption: `Deactivate all`,
                handler: () => {
                    this._toggleAllInList(target, false);
                },
            },
            {
                caption: `Activate all`,
                handler: () => {
                    this._toggleAllInList(target, true);
                },
            },
            {
                caption: `Deactivate all except this`,
                handler: () => {
                    this._toggleAllInList(target, false, event.index);
                },
            },
            {
                caption: `Activate all except this`,
                handler: () => {
                    this._toggleAllInList(target, true, event.index);
                },
            },
            { /* delimiter */ },
            {
                caption: `Remove`,
                handler: () => {
                    this._removeFromList(target, event.request);
                },
            },
            {
                caption: `Remove All`,
                handler: () => {
                    this._removeFromList(target, undefined);
                },
            },
            { /* delimiter */ },
            {
                caption: `Convert to ${event.request instanceof FilterRequest ? 'chart' : 'filter'}`,
                disabled: event.request instanceof FilterRequest ? !ChartRequest.isValid(event.request.asDesc().request) : false,
                handler: () => {
                    this._convertEntryTo(event.request);
                },
            },
        ];
        ContextMenuService.show({
            items: items,
            x: event.event.pageX,
            y: event.event.pageY,
        });
        event.event.stopImmediatePropagation();
        event.event.preventDefault();
    }

    private _toggleAllInList(target: 'filters' | 'charts', state: boolean, exception?: number) {
        if (['filters', 'charts'].indexOf(target) === -1) {
            return;
        }
        if (exception === undefined) {
            (this as any)[`_ng_${target}`] = (this as any)[`_ng_${target}`].map((request: FilterRequest | ChartRequest) => {
                request.setState(state);
                return request;
            });
        } else {
            (this as any)[`_ng_${target}`] = (this as any)[`_ng_${target}`].map((request: FilterRequest | ChartRequest, i: number) => {
                if (exception !== i) {
                    request.setState(state);
                } else {
                    request.setState(!state);
                }
                return request;
            });
        }
    }

    private _convertEntryTo(request: FilterRequest | ChartRequest) {
        // Drop selected
        this._onSelectedInList(undefined);
        if (request instanceof FilterRequest) {
            // From filter to chart
            this._session.getSessionSearch().getFiltersAPI().getStorage().remove(request);
            this._session.getSessionSearch().getChartsAPI().getStorage().add({
                request: request.asDesc().request,
                type: EChartType.smooth,
            });
        } else if (request instanceof ChartRequest) {
            // From filter to chart
            this._session.getSessionSearch().getChartsAPI().getStorage().remove(request);
            this._session.getSessionSearch().getFiltersAPI().getStorage().add({
                request: request.asDesc().request,
                flags: {
                    casesensitive: true,
                    wholeword: true,
                    regexp: true,
                }
            });

        }
    }

    private _removeFromList(target: 'filters' | 'charts', request: FilterRequest | ChartRequest | undefined) {
        if (['filters', 'charts'].indexOf(target) === -1) {
            return;
        }
        if (this._session === undefined) {
            return;
        }
        // Drop selected
        this._onSelectedInList(undefined);
        // Remove all or one request
        switch (target) {
            case 'filters':
                if (request instanceof FilterRequest) {
                    this._session.getSessionSearch().getFiltersAPI().getStorage().remove(request);
                } else {
                    this._session.getSessionSearch().getFiltersAPI().getStorage().clear();
                }
                break;
            case 'charts':
                if (request instanceof ChartRequest) {
                    this._session.getSessionSearch().getChartsAPI().getStorage().remove(request);
                } else {
                    this._session.getSessionSearch().getChartsAPI().getStorage().clear();
                }
                break;
        }
    }

    private _onGlobalKeyUp(event: KeyboardEvent) {
        if (!this._focused) {
            return;
        }
        switch (event.code) {
            case 'ArrowUp':
                this._selected -= 1;
                if (this._selected < 0) {
                    this._selected = this._ng_filters.length + this._ng_charts.length - 1;
                }
                this._subjects.select.next(this._selected);
                break;
            case 'ArrowDown':
                this._selected += 1;
                if (this._selected >= this._ng_filters.length + this._ng_charts.length) {
                    this._selected = 0;
                }
                this._subjects.select.next(this._selected);
                break;
            case 'Enter':
                this._subjects.edit.next();
                break;
        }
        this._setCurrent();
    }

    private _focus() {
        this._self.nativeElement.focus();
    }

    private _onReorderList(event: IReorderEvent) {
        if (event.ddEvent.currentIndex === event.ddEvent.previousIndex) {
            return this._focus();
        }
        switch (event.target) {
            case 'charts':
                const chart: ChartRequest = this._ng_charts[event.ddEvent.previousIndex];
                this._ng_charts = this._ng_charts.filter((i: ChartRequest, index: number) => {
                    return index !== event.ddEvent.previousIndex;
                });
                this._ng_charts.splice(event.ddEvent.currentIndex, 0, chart);
                if (this._session !== undefined) {
                    this._session.getSessionSearch().getChartsAPI().getStorage().reorder({ prev: event.ddEvent.previousIndex, curt: event.ddEvent.currentIndex });
                }
                break;
            case 'filters':
                const filter: FilterRequest = this._ng_filters[event.ddEvent.previousIndex];
                this._ng_filters = this._ng_filters.filter((i: FilterRequest, index: number) => {
                    return index !== event.ddEvent.previousIndex;
                });
                this._ng_filters.splice(event.ddEvent.currentIndex, 0, filter);
                if (this._session !== undefined) {
                    this._session.getSessionSearch().getFiltersAPI().getStorage().reorder({ prev: event.ddEvent.previousIndex, curt: event.ddEvent.currentIndex });
                }
                break;
        }
        this._selected = -1;
        this._subjects.select.next(-1);
        this._setCurrent();
    }

    private _onSelectedInList(guid: string | undefined) {
        let index: number = -1;
        [...this._ng_filters, ...this._ng_charts].forEach((filter: FilterRequest, i: number) => {
            if (index === -1 && filter.getGUID() === guid) {
                index = i;
            }
        });
        if (this._selected === index) {
            this._selected = -1;
        } else {
            this._selected = index;
        }
        this._subjects.select.next(this._selected);
        this._setCurrent();
        this._focus();
    }

    private _setCurrent() {
        this._click++;
        // Differentiate between click and doubleclick
        setTimeout(() => {
            if (this._click === 1) {
                this._ng_filter = undefined;
                this._ng_chart = undefined;
                if (this._selected < this._ng_filters.length && this._ng_filters[this._selected] !== undefined) {
                    this._ng_filter = this._ng_filters[this._selected];
                } else if (this._ng_charts[this._selected - this._ng_filters.length] !== undefined) {
                    this._ng_chart = this._ng_charts[this._selected - this._ng_filters.length];
                }
                if (this._session !== undefined) {
                    this._session.getSessionSearch().getChartsAPI().selectBySource(this._ng_chart === undefined ? undefined : this._ng_chart.asRegExp().source);
                }
                this._forceUpdate();
                this._focus();
            }
            this._click = 0;
        }, 150);
    }

    private _onSessionChange(session: ControllerSessionTab | undefined) {
        this._setActiveSession(session);
    }

    private _setActiveSession(session?: ControllerSessionTab) {
        Object.keys(this._sessionSubscriptions).forEach((prop: string) => {
            this._sessionSubscriptions[prop].unsubscribe();
        });
        this._ng_filters = [];
        this._ng_charts = [];
        if (session === undefined) {
            session = TabsSessionsService.getActive();
        }
        if (session === undefined) {
            this._forceUpdate();
            return;
        }
        this._session = session;
        this._setFilters();
        this._setCharts();
        this._sessionSubscriptions.filtersStorageUpdate = session.getSessionSearch().getFiltersAPI().getStorage().getObservable().updated.subscribe(this._setFilters.bind(this));
        this._sessionSubscriptions.chartsStorageUpdate = session.getSessionSearch().getChartsAPI().getStorage().getObservable().updated.subscribe(this._setCharts.bind(this));
        this._sessionSubscriptions.filename = session.getSessionSearch().getRecentAPI().getObservable().filename.subscribe(this._onFilenameChanged.bind(this));
    }

    private _setFilters(event?: IFiltersStorageUpdated) {
        if (this._session === undefined) {
            return;
        }
        this._ng_filters = this._session.getSessionSearch().getFiltersAPI().getStorage().get();
        if (event !== undefined && event.added instanceof FilterRequest) {
            this._forceUpdate();
            this._selectFilter(event.added);
        } else {
            this._selected = -1;
            this._subjects.select.next(-1);
            this._forceUpdate();
        }
    }

    private _setCharts(event?: IChartsStorageUpdated) {
        if (this._session === undefined) {
            return;
        }
        this._ng_charts = this._session.getSessionSearch().getChartsAPI().getStorage().get();
        if (event !== undefined && event.added instanceof ChartRequest) {
            this._forceUpdate();
            this._selectChart(event.added);
        } else {
            this._selected = -1;
            this._subjects.select.next(-1);
            this._forceUpdate();
        }
    }

    private _selectFilter(filter: FilterRequest) {
        this._ng_filters.forEach((item: FilterRequest, index: number) => {
            if (item.getGUID() === filter.getGUID()) {
                this._ng_filter = filter;
                this._ng_chart = undefined;
                this._selected = index;
                this._subjects.select.next(index);
                this._forceUpdate();
            }
        });
    }

    private _selectChart(chart: ChartRequest) {
        this._ng_charts.forEach((item: ChartRequest, index: number) => {
            if (item.getGUID() === chart.getGUID()) {
                this._ng_filter = undefined;
                this._ng_chart = chart;
                this._selected = index + this._ng_filters.length;
                this._subjects.select.next(index + this._ng_filters.length);
                this._forceUpdate();
            }
        });
        if (this._session !== undefined) {
            this._session.getSessionSearch().getChartsAPI().selectBySource(this._ng_chart === undefined ? undefined : this._ng_chart.asRegExp().source);
        }
    }

    private _onFilenameChanged(filename: string) {
        this._ng_filename = Toolkit.basename(filename);
        this._forceUpdate();
    }

    private _forceUpdate() {
        if (this._destroyed) {
            return;
        }
        this._cdRef.detectChanges();
    }

}
