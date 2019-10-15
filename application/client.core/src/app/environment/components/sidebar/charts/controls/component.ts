import { Component, Input, AfterContentInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { Observable, Subscription } from 'rxjs';
import PopupsService from '../../../../services/standalone/service.popups';
import ElectronIpcService, { IPCMessages } from '../../../../services/service.electron.ipc';
import { NotificationsService, INotification } from '../../../../services.injectable/injectable.service.notifications';
import { DialogsChartsNewActionComponent } from '../../../dialogs/charts.new/component';
import * as Toolkit from 'logviewer.client.toolkit';

@Component({
    selector: 'app-sidebar-app-charts-controls',
    templateUrl: './template.html',
    styleUrls: ['./styles.less']
})

export class SidebarAppChartsControlsComponent implements AfterContentInit, OnDestroy {

    @Input() public setCurrentFilename: (filename: string) => void;
    @Input() public dropChangesFlag: () => void;
    @Input() public onFileReset: Observable<void>;
    @Input() public onChanges: Observable<void>;
    @Input() public filename: string | undefined;
    @Input() public changed: boolean | undefined;

    private _subscriptions: { [key: string]: Subscription } = {};
    private _logger: Toolkit.Logger = new Toolkit.Logger('SidebarAppChartsControlsComponent');
    private _destroyed: boolean = false;

    constructor(private _cdRef: ChangeDetectorRef,
                private _notifications: NotificationsService) {

    }

    ngAfterContentInit() {

    }

    ngOnDestroy() {
        this._destroyed = true;
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
        });
    }

    public _ng_onNew() {
        const popupId: string = PopupsService.add({
            caption: `Add New Chart`,
            component: {
                factory: DialogsChartsNewActionComponent,
                inputs: {
                    close: () => {
                        PopupsService.remove(popupId);
                    }
                }
            },
            buttons: [
                {
                    caption: 'Create',
                    handler: () => {
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

    public _ng_onRecentOpen() {

    }

    public _ng_onLoad(file?: string) {

    }

    public _ng_onSave(saveAs: boolean = false) {

    }

    private _clearRecentHistory() {

    }

    private _setFile(file: string) {
        this.setCurrentFilename(file);
        this.filename = file;
        this._forceUpdate();
    }

    private _onFileReset() {
        this.filename = undefined;
        this._forceUpdate();
    }

    private _onChanges() {
        this.changed = true;
        this._forceUpdate();
    }

    private _forceUpdate() {
        if (this._destroyed) {
            return;
        }
        this._cdRef.detectChanges();
    }

}
