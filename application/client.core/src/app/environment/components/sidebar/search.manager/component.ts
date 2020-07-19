import { Component, OnDestroy, ChangeDetectorRef, AfterViewInit, HostBinding, HostListener, ElementRef } from '@angular/core';
import { Subject, Observable, Subscription } from 'rxjs';
import { CdkDragDrop } from '@angular/cdk/drag-drop';
import { ControllerSessionTab } from '../../../controller/controller.session.tab';
import { IFiltersStorageUpdated, FilterRequest } from 'src/app/environment/controller/controller.session.tab.search.filters.storage';
import { IChartsStorageUpdated, ChartRequest } from 'src/app/environment/controller/controller.session.tab.search.charts.storage';
import { EChartType } from '../../views/chart/charts/charts';
import { NotificationsService } from '../../../services.injectable/injectable.service.notifications';
import { IMenuItem } from '../../../services/standalone/service.contextmenu';
import { TimeRange } from '../../../controller/controller.session.tab.timestamps.range';
import { Providers } from './providers/holder';
import { Provider, EProviders, ISelectEvent } from './providers/provider';
import { ProviderFilters } from './filters/provider';
import { ProviderCharts } from './charts/provider';

import ContextMenuService from '../../../services/standalone/service.contextmenu';
import TabsSessionsService from '../../../services/service.sessions.tabs';
import EventsSessionService from '../../../services/standalone/service.events.session';

import * as Toolkit from 'chipmunk.client.toolkit';

export interface IContextMenuEvent {
    event: MouseEvent;
    request: FilterRequest | ChartRequest;
    index: number;
}

@Component({
    selector: 'app-sidebar-app-searchmanager',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})

export class SidebarAppSearchManagerComponent implements OnDestroy, AfterViewInit {

    public _ng_filename: string = '';
    public _ng_providers: Map<EProviders, Provider<any>> = new Map();
    public _ng_selected: Provider<any> | undefined;

    private _providers: Providers = new Providers();
    private _session: ControllerSessionTab | undefined;
    private _focused: boolean = false;
    private _subscriptions: { [key: string]: Subscription } = {};
    private _subs: { [key: string]: Subscription } = {};
    private _destroyed: boolean = false;

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
                    //this._removeFromList('filters', undefined);
                    //this._removeFromList('charts', undefined);
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
        this._onGlobalKeyUp = this._onGlobalKeyUp.bind(this);
        // this._subscriptions.selected = this._ng_selected.asObservable().subscribe(this._onSelectedInList.bind(this));
    }

    public ngOnDestroy() {
        this._destroyed = true;
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
        });
        Object.keys(this._subs).forEach((prop: string) => {
            this._subs[prop].unsubscribe();
        });
        this._providers.destroy();
        window.removeEventListener('keyup', this._onGlobalKeyUp);
        if (this._session !== undefined) {
            this._session.getSessionSearch().getChartsAPI().selectBySource(undefined);
        }
    }

    public ngAfterViewInit() {
        this._providers.add(EProviders.charts, new ProviderCharts());
        this._providers.add(EProviders.filters, new ProviderFilters());
        this._ng_providers = this._providers.list();
        this._subscriptions.singleSelection = this._providers.getObservable().singleSelection.subscribe(this._onSingleSelection.bind(this));
        this._subscriptions.onSessionChange = EventsSessionService.getObservable().onSessionChange.subscribe(this._onSessionChange.bind(this));
        window.addEventListener('keyup', this._onGlobalKeyUp);
        this._onSessionChange(undefined);
        this._focus();
    }

    public _ng_onPanelClick() {
        this._forceUpdate();
    }

    public _ng_onContextListsMenu(target: 'filters' | 'charts', event: IContextMenuEvent) {
        const items: IMenuItem[] = [
            {
                caption: 'Edit',
                handler: () => {
                    // this._subjects.edit.next(event.request);
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
                    //this._removeFromList(target, event.request);
                },
            },
            {
                caption: `Remove All`,
                handler: () => {
                    //this._removeFromList(target, undefined);
                },
            },
            { /* delimiter */ },
            {
                caption: `Convert to ${event.request instanceof FilterRequest ? 'chart' : 'filter'}`,
                disabled: event.request instanceof FilterRequest ? !ChartRequest.isValid(event.request.asDesc().request) : false,
                handler: () => {
                    //this._convertEntryTo(event.request);
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

    /*
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
    */
    private _onGlobalKeyUp(event: KeyboardEvent) {
        if (!this._focused) {
            return;
        }
        switch (event.code) {
            case 'ArrowUp':
                
                break;
            case 'ArrowDown':
                
                break;
            case 'Enter':
                this._providers.editIn();
                break;
        }
    }

    private _focus() {
        this._self.nativeElement.focus();
    }

    private _onSessionChange(session: ControllerSessionTab | undefined) {
        Object.keys(this._subs).forEach((prop: string) => {
            this._subs[prop].unsubscribe();
        });
        this._ng_selected = undefined;
        if (session === undefined) {
            session = TabsSessionsService.getActive();
        }
        if (session === undefined) {
            this._forceUpdate();
            return;
        }
        this._session = session;
        this._subs.filename = session.getSessionSearch().getRecentAPI().getObservable().filename.subscribe(this._onFilenameChanged.bind(this));
    }

    private _onSingleSelection(event: ISelectEvent | undefined) {
        if (event === undefined && this._ng_selected === undefined) {
            return;
        }
        if (event === undefined) {
            this._ng_selected = undefined;
        } else {
            this._ng_selected = event.provider;
        }
        this._forceUpdate();
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
