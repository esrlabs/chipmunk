import { Component, OnDestroy, ChangeDetectorRef, Input, AfterContentInit, AfterViewInit } from '@angular/core';
import * as Toolkit from 'logviewer.client.toolkit';
import { Subscription, Subject, Observable } from 'rxjs';
import { ServiceData } from './service.data';
import { ServicePosition, IPositionChange } from './service.position';

@Component({
    selector: 'app-views-chart',
    templateUrl: './template.html',
    styleUrls: ['./styles.less']
})

export class ViewChartComponent implements OnDestroy, AfterContentInit, AfterViewInit {

    public _ng_serviceData: ServiceData = new ServiceData();
    public _ng_servicePosition: ServicePosition = new ServicePosition();

    private _subscriptions: { [key: string]: Subscription } = {};
    private _logger: Toolkit.Logger = new Toolkit.Logger('ViewChartComponent');

    constructor(private _cdRef: ChangeDetectorRef) {
    }

    public ngOnDestroy() {
        this._ng_serviceData.destroy();
        this._ng_servicePosition.destroy();
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
        });
    }

    public ngAfterContentInit() {

    }

    public ngAfterViewInit() {

    }

}
