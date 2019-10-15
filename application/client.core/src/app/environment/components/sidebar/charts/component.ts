import { Component, OnDestroy, ChangeDetectorRef, Input, AfterContentInit, AfterViewInit } from '@angular/core';
import * as Toolkit from 'logviewer.client.toolkit';
import { Subscription, Subject, Observable } from 'rxjs';
import { IServices } from '../../../services/shared.services.sidebar';

@Component({
    selector: 'app-sidebar-app-charts',
    templateUrl: './template.html',
    styleUrls: ['./styles.less']
})

export class SidebarAppChartsComponent implements OnDestroy, AfterContentInit, AfterViewInit {

    @Input() public services: IServices;
    @Input() public onBeforeTabRemove: Subject<void>;
    @Input() public close: () => void;

    private _subscriptions: { [key: string]: Subscription } = {};
    private _logger: Toolkit.Logger = new Toolkit.Logger('SidebarAppChartsComponent');

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
