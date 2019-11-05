import { Component, Input, AfterContentInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { Observable, Subscription } from 'rxjs';
import PopupsService from '../../../../../services/standalone/service.popups';
import { DialogsRecentFitlersActionComponent } from '../../../../dialogs/recentfilter/component';
import ElectronIpcService, { IPCMessages } from '../../../../../services/service.electron.ipc';
import SearchSessionsService, { IRequest } from '../../../../../services/service.sessions.search';
import { NotificationsService, INotification } from '../../../../../services.injectable/injectable.service.notifications';
import * as Toolkit from 'chipmunk.client.toolkit';

@Component({
    selector: 'app-sidebar-app-searchmanager-controls',
    templateUrl: './template.html',
    styleUrls: ['./styles.less']
})

export class SidebarAppSearchManagerControlsComponent implements AfterContentInit, OnDestroy {

    @Input() public setCurrentFilename: (filename: string) => void;
    @Input() public dropChangesFlag: () => void;
    @Input() public onFileReset: Observable<void>;
    @Input() public onChanges: Observable<void>;
    @Input() public filename: string | undefined;
    @Input() public changed: boolean | undefined;

    private _subscriptions: { [key: string]: Subscription } = {};
    private _logger: Toolkit.Logger = new Toolkit.Logger('SidebarAppSearchManagerControlsComponent');
    private _destroyed: boolean = false;

    constructor(private _cdRef: ChangeDetectorRef,
                private _notifications: NotificationsService) {

    }

    ngAfterContentInit() {
        this._subscriptions.onFileReset = this.onFileReset.subscribe(this._onFileReset.bind(this));
        this._subscriptions.onChanges = this.onChanges.subscribe(this._onChanges.bind(this));
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
            buttons: [
                {
                    caption: 'Clear Recent History',
                    handler: () => {
                        this._clearRecentHistory();
                        PopupsService.remove(popupId);
                    }
                },
                {
                    caption: 'Cancel',
                    handler: () => {
                        PopupsService.remove(popupId);
                    }
                },
            ],
            options: {
                width: 40
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
            const filters = response.filters.filter((filter) => {
                return Toolkit.regTools.isRegStrValid(filter.reg);
            });
            SearchSessionsService.removeAllStoredRequests();
            SearchSessionsService.insertStoredRequests(filters.map((filter) => {
                return {
                    reg: Toolkit.regTools.createFromStr(filter.reg) as RegExp,
                    color: filter.color,
                    background: filter.background,
                    active: filter.active,
                };
            }));
            this._setFile(response.file);
            this._changes(false);
        }).catch((error: Error) => {
            return this._notifications.add({
                caption: 'Filters',
                message: `Fail to load filters due error: ${error.message}`
            });
        });
    }

    public _ng_onSave(saveAs: boolean = false) {
        if (!saveAs && !this.changed) {
            return;
        }
        const requests: IRequest[] = SearchSessionsService.getStoredRequests();
        if (requests.length === 0) {
            return;
        }
        const filters = requests.map((request: IRequest) => {
            return {
                reg: request.reg.source,
                color: request.color,
                background: request.background,
                active: request.active
            };
        });
        ElectronIpcService.request(new IPCMessages.FiltersSaveRequest({ filters: filters, file: saveAs ? undefined : this.filename }), IPCMessages.FiltersSaveResponse).then((response: IPCMessages.FiltersSaveResponse) => {
            if (response.error !== undefined) {
                return this._notifications.add({
                    caption: 'Filters',
                    message: `Fail to save filters into file "${response.filename}" due error: ${response.error}`
                });
            }
            this._setFile(response.filename);
            this._changes(false);
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

    private _setFile(file: string) {
        this.setCurrentFilename(file);
        this.filename = file;
        this._changes(false);
        this._forceUpdate();
    }

    private _onFileReset() {
        this.filename = undefined;
        this._forceUpdate();
    }

    private _onChanges() {
        this._changes(true);
        this._forceUpdate();
    }

    private _changes(done: boolean) {
        this.changed = done;
        if (!done) {
            this.dropChangesFlag();
        }
    }

    private _forceUpdate() {
        if (this._destroyed) {
            return;
        }
        this._cdRef.detectChanges();
    }

}
