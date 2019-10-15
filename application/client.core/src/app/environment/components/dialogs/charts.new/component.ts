import { Component, ChangeDetectorRef, Input, AfterContentInit } from '@angular/core';
import * as Toolkit from 'logviewer.client.toolkit';
import ElectronIpcService, { IPCMessages, Subscription } from '../../../services/service.electron.ipc';
import { NotificationsService, INotification } from '../../../services.injectable/injectable.service.notifications';

@Component({
    selector: 'app-views-dialogs-charts-new-map',
    templateUrl: './template.html',
    styleUrls: ['./styles.less']
})

export class DialogsChartsNewActionComponent implements AfterContentInit {

    private _logger: Toolkit.Logger = new Toolkit.Logger('DialogsChartsNewActionComponent');

    @Input() close: () => void = () => {};

    constructor(private _cdRef: ChangeDetectorRef,
                private _notifications: NotificationsService) {
    }

    public ngAfterContentInit() {

    }


}
