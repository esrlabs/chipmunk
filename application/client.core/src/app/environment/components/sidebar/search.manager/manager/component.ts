import { Component, Input, AfterContentInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
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
import SearchSessionsService from '../../../../services/service.sessions.search';
import HotkeysService from '../../../../services/service.hotkeys';
import PopupsService from '../../../../services/standalone/service.popups';

@Component({
    selector: 'app-sidebar-app-searchmanager-controls',
    templateUrl: './template.html',
    styleUrls: ['./styles.less']
})

export class SidebarAppSearchManagerControlsComponent implements AfterContentInit, OnDestroy {

    private _filename: string;
    private _changes: boolean = false;
    private _subscriptions: { [key: string]: Subscription } = {};
    private _logger: Toolkit.Logger = new Toolkit.Logger('SidebarAppSearchManagerControlsComponent');
    private _destroyed: boolean = false;

    constructor(private _cdRef: ChangeDetectorRef,
                private _notifications: NotificationsService) {
        HotkeysService.getObservable().recentFilters.subscribe(this._ng_onRecentOpen.bind(this));
    }

    ngAfterContentInit() {

    }

    ngOnDestroy() {
        this._destroyed = true;
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
        });
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
        }).catch((error: Error) => {
            return this._notifications.add({
                caption: 'Filters',
                message: `Fail to load filters due error: ${error.message}`
            });
        });
    }

    public _ng_onSave(saveAs: boolean = false) {
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
            file: saveAs ? undefined : this._filename
        }), IPCMessages.FiltersSaveResponse).then((response: IPCMessages.FiltersSaveResponse) => {
            if (response.error !== undefined) {
                return this._notifications.add({
                    caption: 'Filters',
                    message: `Fail to save filters into file "${response.filename}" due error: ${response.error}`
                });
            }
        }).catch((error: Error) => {
            return this._notifications.add({
                caption: 'Filters',
                message: `Fail to save filters due error: ${error.message}`
            });
        });
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
