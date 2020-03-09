import { Component, OnDestroy, ChangeDetectorRef, ViewContainerRef, AfterViewInit, ViewChild, Input, AfterContentInit, HostListener } from '@angular/core';
import { Subscription, Subject, Observable } from 'rxjs';

@Component({
    selector: 'app-views-plugins-list',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})

export class ViewPluginsListComponent implements OnDestroy, AfterViewInit, AfterContentInit {

    private _subscriptions: { [key: string]: Subscription | undefined } = { };

    constructor(private _cdRef: ChangeDetectorRef,
                private _vcRef: ViewContainerRef) {

    }

    ngAfterViewInit() {

    }

    ngAfterContentInit() {

    }

    public ngOnDestroy() {
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
        });

    }

}
