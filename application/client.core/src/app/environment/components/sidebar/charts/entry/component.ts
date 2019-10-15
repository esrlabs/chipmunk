import { Component, OnDestroy, ChangeDetectorRef, Input, AfterContentInit, AfterViewInit } from '@angular/core';
import * as Toolkit from 'logviewer.client.toolkit';
import { Subscription, Subject, Observable } from 'rxjs';

@Component({
    selector: 'app-sidebar-app-charts-entry',
    templateUrl: './template.html',
    styleUrls: ['./styles.less']
})

export class SidebarAppChartsEntryComponent implements OnDestroy, AfterContentInit, AfterViewInit {

    private _subscriptions: { [key: string]: Subscription } = {};
    private _logger: Toolkit.Logger = new Toolkit.Logger('SidebarAppChartsEntryComponent');

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
