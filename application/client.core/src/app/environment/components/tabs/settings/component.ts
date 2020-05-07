declare var Electron: any;

import { Component, OnDestroy, ChangeDetectorRef, AfterViewInit, ViewChild, Input, AfterContentInit, ElementRef, ViewEncapsulation } from '@angular/core';
import { Subscription, Subject, Observable } from 'rxjs';
import { IPCMessages } from '../../../services/service.electron.ipc';
import { copyTextToClipboard } from '../../../controller/helpers/clipboard';
import { NotificationsService, ENotificationType } from '../../../services.injectable/injectable.service.notifications';

import ServiceElectronIpc from '../../../services/service.electron.ipc';

import * as Toolkit from 'chipmunk.client.toolkit';

@Component({
    selector: 'app-tabs-settings',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})

export class TabSettingsComponent implements OnDestroy, AfterContentInit {

    private _subscriptions: { [key: string]: Toolkit.Subscription | Subscription } = { };
    private _destroyed: boolean = false;

    constructor(private _cdRef: ChangeDetectorRef, private _notifications: NotificationsService) {
    }

    public ngAfterContentInit() {
    }

    public ngOnDestroy() {
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
        });
        this._destroyed = true;
    }


    private _forceUpdate() {
        if (this._destroyed) {
            return;
        }
        this._cdRef.detectChanges();
    }

}
