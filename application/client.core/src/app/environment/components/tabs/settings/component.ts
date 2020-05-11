declare var Electron: any;

import { Component, OnDestroy, ChangeDetectorRef, AfterViewInit, ViewChild, Input, AfterContentInit, ElementRef, ViewEncapsulation } from '@angular/core';
import { Subscription, Subject, Observable } from 'rxjs';
import { NotificationsService, ENotificationType } from '../../../services.injectable/injectable.service.notifications';
import { Entry, Field } from '../../../controller/settings/field.store';

import SettingsService from '../../../services/service.settings';

import * as Toolkit from 'chipmunk.client.toolkit';

@Component({
    selector: 'app-tabs-settings',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})

export class TabSettingsComponent implements OnDestroy, AfterContentInit {

    public _ng_entries: Map<string, Entry | Field<any>> = new Map();
    public _ng_fields: Map<string, Field<any>> = new Map();
    public _ng_focused: Entry | undefined;
    public _ng_focusedSubject: Subject<string> = new Subject();
    public _ng_filter: string = '';

    private _subscriptions: { [key: string]: Toolkit.Subscription | Subscription } = { };
    private _destroyed: boolean = false;
    private _logger: Toolkit.Logger = new Toolkit.Logger('TabSettingsComponent');

    constructor(private _cdRef: ChangeDetectorRef,
                private _notifications: NotificationsService) {
        this._ng_focusedSubject.asObservable().subscribe(this._onFocusChange.bind(this));
    }

    public ngAfterContentInit() {
        SettingsService.get().then((entries) => {
            this._ng_entries = entries;
            this._forceUpdate();
        }).catch((error: Error) => {
            this._logger.error(`Fail get settings data due error: ${error.message}`);
        });
    }

    public ngOnDestroy() {
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
        });
        this._destroyed = true;
    }

    private _onFocusChange(path: string) {
        const entry: Entry | Field<any> | undefined = this._ng_entries.get(path);
        if (entry === undefined) {
            return;
        }
        this._ng_focused = entry;
        const fields: Map<string, Field<any>> = new Map();
        this._ng_entries.forEach((field: Entry | Field<any>, key: string) => {
            if (!(field instanceof Field) || field.getPath() !== path) {
                return;
            }
            fields.set(key, field);
        });
        this._ng_fields = fields;
        this._forceUpdate();
    }

    private _forceUpdate() {
        if (this._destroyed) {
            return;
        }
        this._cdRef.detectChanges();
    }

}
