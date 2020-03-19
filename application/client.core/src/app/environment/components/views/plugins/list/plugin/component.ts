import { Component, Input, OnDestroy, ChangeDetectorRef, AfterContentInit, HostBinding } from '@angular/core';
import { Subscription, Subject } from 'rxjs';
import { CommonInterfaces } from '../../../../../interfaces/interface.common';

import PluginsService from '../../../../../services/service.plugins';

import * as Toolkit from 'chipmunk.client.toolkit';

export interface IPlugin extends CommonInterfaces.Plugins.IPlugin {
    installed: boolean;
}

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

    public _ng_onInstallPlugin() {
        this._ng_state = EPluginState.download;
        PluginsService.getManager().install(this.plugin.name).then(() => {
            this._ng_state = EPluginState.restart;
        }).catch((error: Error) => {
            this._logger.error(`Fail to request downloading of plugin due error: ${error.message}`);
            this._ng_error = error.message;
            this._ng_state = EPluginState.error;
        }).finally(() => {
            this._cdRef.detectChanges();
        });
    }

    public _ng_onRestartPlugin() {
        PluginsService.getManager().restart().then(() => {
            this._logger.debug(`Application will be restarted`);
        }).catch((error: Error) => {
            this._logger.error(`Fail to request restart of application due error: ${error.message}`);
        });
    }

}
