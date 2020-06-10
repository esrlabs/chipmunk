import { Component, OnDestroy, ChangeDetectorRef, Input, AfterContentInit, AfterViewInit } from '@angular/core';
import { Subscription } from 'rxjs';

import * as Toolkit from 'chipmunk.client.toolkit';

@Component({
    selector: 'app-views-measurement',
    templateUrl: './template.html',
    styleUrls: ['./styles.less']
})

export class ViewMeasurementComponent implements OnDestroy, AfterContentInit, AfterViewInit {

    private _subscriptions: { [key: string]: Subscription } = {};
    private _logger: Toolkit.Logger = new Toolkit.Logger('ViewMeasurementComponent');

    constructor(private _cdRef: ChangeDetectorRef) {
    }

    public ngOnDestroy() {
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
        });
    }

    public ngAfterContentInit() {

    }

    public ngAfterViewInit() {

    }

}
