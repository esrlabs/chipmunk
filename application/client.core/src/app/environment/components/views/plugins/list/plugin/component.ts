import { Component, Input, OnDestroy, ChangeDetectorRef, AfterContentInit } from '@angular/core';
import { Subscription, Observable } from 'rxjs';
import { CommonInterfaces } from '../../../../../interfaces/interface.common';
import ElectronIpcService, { IPCMessages } from '../../../../../services/service.electron.ipc';

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

    @Input() public plugin: IPlugin | undefined;

    public _ng_state: EPluginState = EPluginState.pending;
    public _ng_error: string | undefined;

    private _subscriptions: { [key: string]: Subscription } = {};
    private _logger: Toolkit.Logger = new Toolkit.Logger('ViewPluginsPluginComponent');

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
        ElectronIpcService.request(new IPCMessages.PluginsInstallRequest({
            name: this.plugin.name
        }), IPCMessages.PluginsInstallResponse).then((response: IPCMessages.PluginsInstallResponse) => {
            if (typeof response.error === 'string') {
                this._ng_state = EPluginState.error;
                this._ng_error = response.error;
                this._logger.error(`Fail to download plugin due error: ${response.error}`);
            } else {
                this._ng_state = EPluginState.restart;
            }
            this._cdRef.detectChanges();
        }).catch((error: Error) => {
            this._ng_error = error.message;
            this._ng_state = EPluginState.error;
            this._logger.error(`Fail to request downloading of plugin due error: ${error.message}`);
        });
    }

    public _ng_onRestartPlugin() {
        ElectronIpcService.request(new IPCMessages.AppRestartRequest(), IPCMessages.AppRestartResponse).then((response: IPCMessages.AppRestartResponse) => {
        }).catch((error: Error) => {
            this._logger.error(`Fail to restart due error: ${error.message}`);
        });
    }

}
