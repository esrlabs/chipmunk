import { Component, AfterContentInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { Subscription } from 'rxjs';
import { ControllerSessionTabSearchStore } from '../../../../controller/session/dependencies/search/dependencies/store/controller.session.tab.search.store';
import { DialogsRecentFitlersActionComponent } from '../../../dialogs/recentfilter/component';
import { NotificationsService } from '../../../../services.injectable/injectable.service.notifications';
import { Session } from '../../../../controller/session/session';
import { IPCMessages } from '../../../../services/service.electron.ipc';

import * as Toolkit from 'chipmunk.client.toolkit';

import TabsSessionsService from '../../../../services/service.sessions.tabs';
import HotkeysService from '../../../../services/service.hotkeys';
import PopupsService from '../../../../services/standalone/service.popups';
import EventsSessionService from '../../../../services/standalone/service.events.session';
import ServiceElectronIpc from '../../../../services/service.electron.ipc';

@Component({
    selector: 'app-sidebar-app-searchmanager-controls',
    templateUrl: './template.html',
    styleUrls: ['./styles.less']
})

export class SidebarAppSearchManagerControlsComponent implements AfterContentInit, OnDestroy {

    private _subscriptions: { [key: string]: Subscription | Toolkit.Subscription } = {};
    private _sessionSubscriptions: { [key: string]: Subscription } = {};
    private _logger: Toolkit.Logger = new Toolkit.Logger('SidebarAppSearchManagerControlsComponent');
    private _controller: ControllerSessionTabSearchStore;
    private _destroyed: boolean = false;

    constructor(private _cdRef: ChangeDetectorRef,
                private _notifications: NotificationsService) {
        HotkeysService.getObservable().recentFilters.subscribe(this._ng_onRecentOpen.bind(this));
    }

    ngAfterContentInit() {
        this._subscriptions.onSessionChange = EventsSessionService.getObservable().onSessionChange.subscribe(this._onSessionChange.bind(this));
        this._onSessionChange();
        this._subscriptions.openFilters = ServiceElectronIpc.subscribe(IPCMessages.FiltersOpen, this._ipc_onFiltersOpen.bind(this));
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
            id: 'recent-filters-dialog',
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
        this._controller.load(file).then((filename: string) => {
            this._setCurrentFile(filename);
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

    private _onSessionChange(controller?: Session) {
        if (controller === undefined) {
            controller = TabsSessionsService.getActive();
        }
        if (controller === undefined) {
            return;
        }
        this._controller = controller.getSessionSearch().getStoreAPI();
        // Restore filename
        this._setCurrentFile(this._controller.getCurrentFile());
    }

    private _setCurrentFile(filename: string) {
        if (this._controller === undefined) {
            return;
        }
        this._controller.setCurrentFile(filename);
    }

    private _ipc_onFiltersOpen() {
        this._ng_onLoad();
    }

}
