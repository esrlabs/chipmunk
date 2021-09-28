// tslint:disable:member-ordering

import {
    Component,
    OnDestroy,
    ChangeDetectorRef,
    AfterContentInit,
    AfterViewInit,
} from '@angular/core';
import { Subscription, Observable, Subject } from 'rxjs';

import PluginsService from '../../../../services/service.plugins';

@Component({
    selector: 'app-views-plugins-counter',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
export class TabPluginsCounterComponent implements OnDestroy, AfterViewInit {
    public _ng_count: number = 0;

    private _subscriptions: { [key: string]: Subscription } = {};
    private _destroyed: boolean = false;

    constructor(private _cdRef: ChangeDetectorRef) {}

    public ngAfterViewInit() {
        this._subscriptions.ready = PluginsService.getManager()
            .getObservable()
            .ready.subscribe(this._refresh.bind(this));
        this._subscriptions.updater = PluginsService.getManager()
            .getObservable()
            .updater.subscribe(this._refresh.bind(this));
        this._subscriptions.custom = PluginsService.getManager()
            .getObservable()
            .custom.subscribe(this._refresh.bind(this));
        this._subscriptions.fds = PluginsService.getManager()
            .getObservable()
            .updater.subscribe(this._refresh.bind(this));
        this._subscriptions.custom = PluginsService.getManager()
            .getObservable()
            .upgrade.subscribe(this._refresh.bind(this));
        this._refresh();
    }

    public ngOnDestroy() {
        this._destroyed = true;
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
        });
    }

    private _refresh() {
        this._ng_count = PluginsService.getManager().getCountToBeUpgradedUpdated();
        this._forceUpdate();
    }

    private _forceUpdate() {
        if (this._destroyed) {
            return;
        }
        this._cdRef.detectChanges();
    }
}
