import { Component, OnDestroy, ChangeDetectorRef, AfterViewInit, ViewChild, Input, AfterContentInit, ElementRef, ViewEncapsulation } from '@angular/core';
import { Subscription, Subject, Observable } from 'rxjs';
import { Entry, Field } from '../../../../controller/settings/field.store';

import SettingsService from '../../../../services/service.settings';

import * as Toolkit from 'chipmunk.client.toolkit';

@Component({
    selector: 'app-tabs-settings-element',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
    encapsulation: ViewEncapsulation.None,
})

export class TabSettingsElementComponent implements OnDestroy, AfterContentInit {

    @Input() public field: Field<any>;

    public _ng_value: any;

    private _subscriptions: { [key: string]: Toolkit.Subscription | Subscription } = { };
    private _destroyed: boolean = false;
    private _logger: Toolkit.Logger = new Toolkit.Logger('TabSettingsElementComponent');

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
