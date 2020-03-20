import { Component, Input, OnDestroy, ChangeDetectorRef, AfterContentInit, HostBinding } from '@angular/core';
import { Subscription, Subject } from 'rxjs';
import { IPlugin } from '../../../../../controller/controller.plugins.manager';

import * as Toolkit from 'chipmunk.client.toolkit';

enum EPluginState {
    download = 'download',
    restart = 'restart',
    pending = 'pending',
    error = 'error',
}

@Component({
    selector: 'app-views-plugin',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})

export class ViewPluginsPluginComponent implements AfterContentInit, OnDestroy {

    @Input() public plugin: IPlugin;
    @Input() public selected: boolean;

    public _ng_state: EPluginState = EPluginState.pending;
    public _ng_error: string | undefined;

    private _subscriptions: { [key: string]: Subscription } = {};
    private _logger: Toolkit.Logger = new Toolkit.Logger('ViewPluginsPluginComponent');

    @HostBinding('class.selected') get cssClassSelected() {
        return this.selected;
    }

    constructor(private _cdRef: ChangeDetectorRef ) {
    }

    public ngOnDestroy() {
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
        });
    }

    public ngAfterContentInit() {
        this._logger = new Toolkit.Logger(`ViewPluginsPluginComponent (${this.plugin.name})`);
    }

}
