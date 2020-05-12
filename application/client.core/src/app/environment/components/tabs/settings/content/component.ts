import { Component, OnDestroy, ChangeDetectorRef, AfterViewInit, OnChanges, Input, AfterContentInit, SimpleChanges } from '@angular/core';
import { Subscription, Subject, Observable } from 'rxjs';
import { Entry, ConnectedField, LocalField } from '../../../../controller/settings/field.store';
import { NotificationsService, ENotificationType } from '../../../../services.injectable/injectable.service.notifications';

import SettingsService from '../../../../services/service.settings';

import * as Toolkit from 'chipmunk.client.toolkit';

interface IChange {
    target: ConnectedField<any> | LocalField<any>;
    value: any;
}

@Component({
    selector: 'app-tabs-settings-content',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})

export class TabSettingsContentComponent implements OnDestroy, AfterContentInit, OnChanges {

    @Input() public entry: Entry;
    @Input() public fields: Array<ConnectedField<any> | LocalField<any>> = [];

    private _subscriptions: { [key: string]: Toolkit.Subscription | Subscription } = { };
    private _destroyed: boolean = false;
    private _logger: Toolkit.Logger = new Toolkit.Logger('TabSettingsContentComponent');
    private _changes: Map<string, IChange> = new Map();
    private _working: boolean = false;

    constructor(private _cdRef: ChangeDetectorRef,
                private _notifications: NotificationsService) {
    }

    public ngAfterContentInit() {

    }

    public ngOnChanges(changes: SimpleChanges) {
        /*
        if (changes.fields === undefined && changes.entry === undefined) {
            return;
        }
        */
        this._changes.clear();
    }

    public ngOnDestroy() {
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
        });
        this._destroyed = true;
    }

    public _ng_hasChanges(): boolean {
        return this._changes.size > 0;
    }

    public _ng_getChangeCallback(field: ConnectedField<any> | LocalField<any>) {
        return this._onFieldChanged.bind(this, field);
    }

    public _ng_onApply() {
        if (!this._ng_hasChanges()) {
            return;
        }
        this._working = true;
        Promise.all(Array.from(this._changes.values()).map((change: IChange) => {
            return change.target.set(change.value);
        })).catch((changeErr: Error) => {
            this._notifications.add({
                caption: 'Settings',
                message: `Fail save settings due error: ${changeErr.message}`,
                options: { type: ENotificationType.warning },
            });
        }).finally(() => {
            this._changes.clear();
            this._working = false;
            this._forceUpdate();
        });
        this._forceUpdate();
    }

    public _ng_isWorking(): boolean {
        return this._working;
    }

    private _onFieldChanged(field: ConnectedField<any> | LocalField<any>, value: any) {
        if (field.get() !== value) {
            this._changes.set(field.getFullPath(), {
                target: field,
                value: value,
            });
        } else {
            this._changes.delete(field.getFullPath());
        }
    }

    private _forceUpdate() {
        if (this._destroyed) {
            return;
        }
        this._cdRef.detectChanges();
    }

}
