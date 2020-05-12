import { Component, OnDestroy, ChangeDetectorRef, AfterViewInit, ViewChild, Input, AfterContentInit, ElementRef, ViewEncapsulation } from '@angular/core';
import { Subscription, Subject, Observable } from 'rxjs';
import { Entry, ConnectedField, Field } from '../../../../controller/settings/field.store';

import SettingsService from '../../../../services/service.settings';

import * as Toolkit from 'chipmunk.client.toolkit';

@Component({
    selector: 'app-tabs-settings-content',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})

export class TabSettingsContentComponent implements OnDestroy, AfterContentInit {

    @Input() public entry: Entry;
    @Input() public fields: Array<ConnectedField<any> | Field<any>> = [];

    private _subscriptions: { [key: string]: Toolkit.Subscription | Subscription } = { };
    private _destroyed: boolean = false;
    private _logger: Toolkit.Logger = new Toolkit.Logger('TabSettingsContentComponent');

    constructor(private _cdRef: ChangeDetectorRef) {
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
