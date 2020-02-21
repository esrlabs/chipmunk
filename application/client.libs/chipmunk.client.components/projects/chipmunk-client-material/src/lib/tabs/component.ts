import { Component, Input, OnDestroy, AfterViewInit, ChangeDetectorRef } from '@angular/core';
import { Subscription } from 'rxjs';
import { TabsService } from './service';
import { TabsOptions, ETabsListDirection } from './options';

@Component({
    selector: 'lib-complex-tabs',
    templateUrl: './template.html',
    styleUrls: ['./styles.less']
})

export class TabsComponent implements OnDestroy, AfterViewInit {

    @Input() public service: TabsService;

    private _subscriptions: { [key: string]: Subscription } = {};
    private _destroyed: boolean = false;

    public _options: TabsOptions = new TabsOptions();

    constructor(private _cdRef: ChangeDetectorRef) {
    }

    ngAfterViewInit() {
        if (!this.service) {
            return;
        }
        this._subscriptions.options = this.service.getObservable().options.subscribe(this._onOptionsUpdated.bind(this));
        this._getDefaultOptions();
    }

    ngOnDestroy() {
        this._destroyed = true;
        Object.keys(this._subscriptions).forEach((key: string) => {
            if (this._subscriptions[key] !== null) {
                this._subscriptions[key].unsubscribe();
            }
        });
    }

    private async _getDefaultOptions() {
        this._options = await this.service.getOptions();
        this._forceUpdate();
    }

    private async _onOptionsUpdated(options: TabsOptions) {
        this._options = await options;
        this._forceUpdate();
    }

    private _forceUpdate() {
        if (this._destroyed) {
            return;
        }
        this._cdRef.detectChanges();
    }

}
