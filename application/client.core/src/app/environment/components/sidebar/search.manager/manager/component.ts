import { Component, Input, AfterContentInit, OnDestroy, ChangeDetectorRef, EventEmitter, Output } from '@angular/core';
import { Observable, Subscription } from 'rxjs';
import { ControllerSessionTabSearchFilters } from '../../../../controller/controller.session.tab.search.filters';
import { ControllerSessionTabSearchCharts } from '../../../../controller/controller.session.tab.search.charts';
import { DialogsRecentFitlersActionComponent } from '../../../dialogs/recentfilter/component';
import { NotificationsService } from '../../../../services.injectable/injectable.service.notifications';
import { ControllerSessionTab } from '../../../../controller/controller.session.tab';
import { FiltersStorage, FilterRequest } from 'src/app/environment/controller/controller.session.tab.search.filters.storage';
import { ChartsStorage, ChartRequest } from 'src/app/environment/controller/controller.session.tab.search.charts.storage';

import * as Toolkit from 'chipmunk.client.toolkit';

import ElectronIpcService, { IPCMessages } from '../../../../services/service.electron.ipc';

import TabsSessionsService from '../../../../services/service.sessions.tabs';
import HotkeysService from '../../../../services/service.hotkeys';
import PopupsService from '../../../../services/standalone/service.popups';

@Component({
    selector: 'app-sidebar-app-searchmanager-controls',
    templateUrl: './template.html',
    styleUrls: ['./styles.less']
})

export class SidebarAppSearchManagerControlsComponent implements AfterContentInit, OnDestroy {

    @Output() public filename: EventEmitter<string> = new EventEmitter();

    private _filename: string = '';
    private _subscriptions: { [key: string]: Subscription } = {};
    private _sessionSubscriptions: { [key: string]: Subscription } = {};
    private _logger: Toolkit.Logger = new Toolkit.Logger('SidebarAppSearchManagerControlsComponent');
    private _destroyed: boolean = false;

    constructor(private _cdRef: ChangeDetectorRef,
                private _notifications: NotificationsService) {
        HotkeysService.getObservable().recentFilters.subscribe(this._ng_onRecentOpen.bind(this));
    }

    ngAfterContentInit() {
        this._subscriptions.onSessionChange = TabsSessionsService.getObservable().onSessionChange.subscribe(this._onSessionChange.bind(this));
        this._onSessionChange();
    }

    ngOnDestroy() {
        this._destroyed = true;
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
        });
        Object.keys(this._sessionSubscriptions).forEach((prop: string) => {
            this._sessionSubscriptions[prop].unsubscribe();
        });
        this._autoSave();
    }

    public _ng_onRecentOpen() {
        const popupId: string = PopupsService.add({
            caption: `Open Recent Filters`,
            component: {
                factory: DialogsRecentFitlersActionComponent,
                inputs: {
                    open: this._ng_onLoad.bind(this),
                    close: () => {
                        PopupsService.remove(popupId);
                    }
                }
            },
            buttons: [ ],
            options: {
                width: 40,
                minimalistic: true,
            }
        });
    }

    public _ng_onLoad(file?: string) {
        ElectronIpcService.request(new IPCMessages.FiltersLoadRequest({
            file: file,
        }), IPCMessages.FiltersLoadResponse).then((response: IPCMessages.FiltersLoadResponse) => {
            if (response.error !== undefined) {
                return this._notifications.add({
                    caption: 'Filters',
                    message: `Fail to load filters due error: ${response.error}`
                });
            }
            const session: ControllerSessionTab | undefined = TabsSessionsService.getActive();
            if (session === undefined) {
                return;
            }
            // Get refs to storages
            const filters: FiltersStorage = session.getSessionSearch().getFiltersAPI().getStorage();
            const charts: ChartsStorage = session.getSessionSearch().getChartsAPI().getStorage();
            // Drop data in storage
            filters.clear();
            charts.clear();
            // Add new
            filters.add(response.filters.map((filter: IPCMessages.IFilter) => {
                return {
                    request: filter.expression.request,
                    flags: filter.expression.flags,
                    color: filter.color,
                    background: filter.background,
                    state: filter.active,
                };
            }));
            charts.add(response.charts.map((chart: IPCMessages.IChartSaveRequest) => {
                return {
                    request: chart.request,
                    type: chart.type,
                    color: chart.color,
                    state: chart.active,
                    options: chart.options,
                };
            }));
            this._setCurrentFile(response.file);
        }).catch((error: Error) => {
            return this._notifications.add({
                caption: 'Filters',
                message: `Fail to load filters due error: ${error.message}`
            });
        });
    }

    public _ng_onSave(filename?: string) {
        const session: ControllerSessionTab | undefined = TabsSessionsService.getActive();
        if (session === undefined) {
            return;
        }
        // Get refs to storages
        const filters: FiltersStorage = session.getSessionSearch().getFiltersAPI().getStorage();
        const charts: ChartsStorage = session.getSessionSearch().getChartsAPI().getStorage();
        ElectronIpcService.request(new IPCMessages.FiltersSaveRequest({
            filters: filters.get().map((filter: FilterRequest) => {
                const desc = filter.asDesc();
                return {
                    expression: {
                        request: desc.request,
                        flags: desc.flags,
                    },
                    color: desc.color,
                    background: desc.background,
                    active: desc.active,
                };
            }),
            charts: charts.get().map((chart: ChartRequest) => {
                const desc = chart.asDesc();
                return {
                    request: desc.request,
                    color: desc.color,
                    active: desc.active,
                    type: desc.type,
                    options: desc.options,
                };
            }),
            file: filename
        }), IPCMessages.FiltersSaveResponse).then((response: IPCMessages.FiltersSaveResponse) => {
            if (response.error !== undefined) {
                this._setCurrentFile('');
                return this._notifications.add({
                    caption: 'Filters',
                    message: `Fail to save filters into file "${response.filename}" due error: ${response.error}`
                });
            }
            this._setCurrentFile(response.filename);
        }).catch((error: Error) => {
            this._setCurrentFile('');
            return this._notifications.add({
                caption: 'Filters',
                message: `Fail to save filters due error: ${error.message}`
            });
        });
    }

    private _onSessionChange() {
        Object.keys(this._sessionSubscriptions).forEach((prop: string) => {
            this._sessionSubscriptions[prop].unsubscribe();
        });
        const session: ControllerSessionTab | undefined = TabsSessionsService.getActive();
        if (session === undefined) {
            return;
        }
        // Get refs to storages
        const filters: FiltersStorage = session.getSessionSearch().getFiltersAPI().getStorage();
        const charts: ChartsStorage = session.getSessionSearch().getChartsAPI().getStorage();
        // Subscribe to any change
        this._sessionSubscriptions.filtersStorageUpdate = filters.getObservable().updated.subscribe(this._autoSave.bind(this));
        this._sessionSubscriptions.chartsStorageUpdate = charts.getObservable().updated.subscribe(this._autoSave.bind(this));
        this._sessionSubscriptions.filtersStorageChanged = filters.getObservable().changed.subscribe(this._autoSave.bind(this));
        this._sessionSubscriptions.chartsStorageChanged = charts.getObservable().changed.subscribe(this._autoSave.bind(this));
    }

    private _autoSave() {
        if (this._filename === '') {
            return;
        }
        const session: ControllerSessionTab | undefined = TabsSessionsService.getActive();
        if (session === undefined) {
            return;
        }
        // Get refs to storages
        const filters: FiltersStorage = session.getSessionSearch().getFiltersAPI().getStorage();
        const charts: ChartsStorage = session.getSessionSearch().getChartsAPI().getStorage();
        if (filters.get().length === 0 && charts.get().length === 0) {
            // Do not save if it was cleared
            return;
        }
        this._ng_onSave(this._filename);
    }

    private _setCurrentFile(filename: string) {
        this._filename = filename;
        this.filename.emit(filename);
    }

    private _clearRecentHistory() {
        ElectronIpcService.request(new IPCMessages.FiltersFilesRecentResetRequest(), IPCMessages.FiltersFilesRecentResetResponse).then((message: IPCMessages.FiltersFilesRecentResetResponse) => {
            if (message.error) {
                this._logger.error(`Fail to reset recent files due error: ${message.error}`);
            }
        }).catch((error: Error) => {
            this._logger.error(`Fail to reset recent files due error: ${error.message}`);
        });
    }

    private _forceUpdate() {
        if (this._destroyed) {
            return;
        }
        this._cdRef.detectChanges();
    }

}
