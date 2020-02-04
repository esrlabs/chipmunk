import { Component, Input, AfterContentInit, OnDestroy, ChangeDetectorRef, EventEmitter, Output } from '@angular/core';
import { Observable, Subscription } from 'rxjs';
import { ControllerSessionTabSearchRecent } from '../../../../controller/controller.session.tab.search.recent';
import { DialogsRecentFitlersActionComponent } from '../../../dialogs/recentfilter/component';
import { NotificationsService } from '../../../../services.injectable/injectable.service.notifications';
import { ControllerSessionTab } from '../../../../controller/controller.session.tab';

import * as Toolkit from 'chipmunk.client.toolkit';

import TabsSessionsService from '../../../../services/service.sessions.tabs';
import HotkeysService from '../../../../services/service.hotkeys';
import PopupsService from '../../../../services/standalone/service.popups';

@Component({
    selector: 'app-sidebar-app-searchmanager-controls',
    templateUrl: './template.html',
    styleUrls: ['./styles.less']
})

export class SidebarAppSearchManagerControlsComponent implements AfterContentInit, OnDestroy {

    private _subscriptions: { [key: string]: Subscription } = {};
    private _sessionSubscriptions: { [key: string]: Subscription } = {};
    private _logger: Toolkit.Logger = new Toolkit.Logger('SidebarAppSearchManagerControlsComponent');
    private _controller: ControllerSessionTabSearchRecent;
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
        if (this._controller === undefined) {
            return;
        }
        // We should unsubscribe from session events during loading to prevent circle saving
        this._unsubscribeSessionEvents();
        this._controller.load(file).then((filename: string) => {
            this._setCurrentFile(filename);
            this._subscribeSessionEvents();
        }).catch((error: Error) => {
            this._notifications.add({
                caption: 'Filters',
                message: `Fail to load filters due error: ${error.message}`
            });
        });
    }

    public _ng_onSave(file?: string) {
        if (this._controller === undefined) {
            return;
        }
        this._controller.save(file).then((filename: string) => {
            this._setCurrentFile(filename);
        }).catch((error: Error) => {
            this._setCurrentFile('');
            this._notifications.add({
                caption: 'Filters',
                message: `Fail to save filters due error: ${error.message}`
            });
        });
    }

    public _ng_getSaveButtonLabel(): string {
        if (this._controller === undefined) {
            return '';
        }
        return this._controller.getCurrentFile() === '' ? 'Save' : 'Save As';
    }

    private _onSessionChange(controller?: ControllerSessionTab) {
        this._unsubscribeSessionEvents();
        if (controller === undefined) {
            controller = TabsSessionsService.getActive();
        }
        if (controller === undefined) {
            return;
        }
        this._controller = controller.getSessionSearch().getRecentAPI();
        // Restore filename
        this._setCurrentFile(this._controller.getCurrentFile());
        // Subscribe to any change
        this._subscribeSessionEvents();
    }

    private _unsubscribeSessionEvents() {
        Object.keys(this._sessionSubscriptions).forEach((prop: string) => {
            this._sessionSubscriptions[prop].unsubscribe();
        });
    }

    private _subscribeSessionEvents() {
        if (this._controller === undefined) {
            return;
        }
        this._sessionSubscriptions.filtersStorageUpdate = this._controller.getFiltersStorage().getObservable().updated.subscribe(this._autoSave.bind(this));
        this._sessionSubscriptions.chartsStorageUpdate = this._controller.getChartsStorage().getObservable().updated.subscribe(this._autoSave.bind(this));
        this._sessionSubscriptions.filtersStorageChanged = this._controller.getFiltersStorage().getObservable().changed.subscribe(this._autoSave.bind(this));
        this._sessionSubscriptions.chartsStorageChanged = this._controller.getChartsStorage().getObservable().changed.subscribe(this._autoSave.bind(this));
    }

    private _autoSave() {
        if (this._controller === undefined) {
            return;
        }
        if (this._controller.getCurrentFile() === '') {
            return;
        }
        if (this._controller.getFiltersStorage().get().length === 0 && this._controller.getChartsStorage().get().length === 0) {
            // Do not save if it was cleared
            return;
        }
        this._ng_onSave(this._controller.getCurrentFile());
    }

    private _setCurrentFile(filename: string) {
        if (this._controller === undefined) {
            return;
        }
        this._controller.setCurrentFile(filename);
    }

    private _forceUpdate() {
        if (this._destroyed) {
            return;
        }
        this._cdRef.detectChanges();
    }

}
