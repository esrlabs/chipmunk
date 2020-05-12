import { Component, OnDestroy, ChangeDetectorRef, AfterViewInit, OnChanges, Input, AfterContentInit, SimpleChanges } from '@angular/core';
import { Subscription, Subject, Observable } from 'rxjs';
import { Entry, ConnectedField, Field } from '../../../../controller/settings/field.store';

import SettingsService from '../../../../services/service.settings';

import * as Toolkit from 'chipmunk.client.toolkit';

@Component({
    selector: 'app-tabs-settings-content',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})

export class TabSettingsContentComponent implements OnDestroy, AfterContentInit, OnChanges {

    @Input() public entry: Entry;
    @Input() public fields: Array<ConnectedField<any> | Field<any>> = [];

    private _subscriptions: { [key: string]: Toolkit.Subscription | Subscription } = { };
    private _destroyed: boolean = false;
    private _logger: Toolkit.Logger = new Toolkit.Logger('TabSettingsContentComponent');
    private _changes: Map<string, boolean> = new Map();

    constructor(private _cdRef: ChangeDetectorRef) {
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

    public _ng_getChangeCallback(field: ConnectedField<any> | Field<any>) {
        return this._onFieldChanged.bind(this, field);
    }

    private _onFieldChanged(field: ConnectedField<any> | Field<any>, value: any) {
        if (field.get() !== value) {
            this._changes.set(field.getFullPath(), true);
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
