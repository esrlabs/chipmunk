import { Component, Input, OnDestroy, ChangeDetectorRef, AfterContentInit } from '@angular/core';
import { Subscription, Observable } from 'rxjs';
import { CommonInterfaces } from '../../../../interfaces/interface.common';

export interface IPlugin extends CommonInterfaces.Plugins.IPlugin {
    installed: boolean;
}

@Component({
    selector: 'app-views-plugins-details',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})

export class ViewPluginsDetailsComponent implements AfterContentInit, OnDestroy {

    @Input() public plugin: IPlugin | undefined;

    private _subscriptions: { [key: string]: Subscription } = {};

    constructor(private _cdRef: ChangeDetectorRef ) {
    }

    public ngOnDestroy() {
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
        });
    }

    public ngAfterContentInit() {

    }

    public _ng_onLoad(event) {
        console.log(event);
    }

    public _ng_onError(event) {
        console.log(event);
    }

}
