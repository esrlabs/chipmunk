import { Component, OnDestroy, ChangeDetectorRef } from '@angular/core';
import PluginsService from '../../services/service.plugins';

@Component({
    selector: 'app-layout-status-bar',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
export class LayoutStatusBarComponent implements OnDestroy {
    public _ng_plugins: any[] = [];

    constructor(private _cdRef: ChangeDetectorRef) {
        this._onTaskBarPlugin = this._onTaskBarPlugin.bind(this);
        PluginsService.subscribe(PluginsService.Events.onTaskBarPlugin, this._onTaskBarPlugin);
    }

    ngOnDestroy() {
        PluginsService.unsubscribe(PluginsService, this._onTaskBarPlugin);
    }

    private _onTaskBarPlugin(pluginId: number, factory: any, ipc: any) {
        this._ng_plugins.push({
            factory: factory,
            resolved: true,
            inputs: {
                session: -1,
                ipc: ipc,
            },
        });
        this._cdRef.detectChanges();
    }
}
