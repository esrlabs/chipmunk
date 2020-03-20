import { Component, Input, OnDestroy, ChangeDetectorRef, AfterContentInit, ViewEncapsulation } from '@angular/core';
import { Subscription, Subject } from 'rxjs';
import { IPlugin } from '../../../../controller/controller.plugins.manager';
import { IDependencyState, getDependenciesStates } from '../../../../controller/helpers/versions';
import { NotificationsService } from '../../../../services.injectable/injectable.service.notifications';

import PluginsService from '../../../../services/service.plugins';

import * as Toolkit from 'chipmunk.client.toolkit';

enum EReadmeState {
    ready = 'ready',
    pending = 'pending',
    error = 'error',
}

enum EPluginState {
    installed = 'installed',
    notinstalled = 'notinstalled',
    working = 'working',
    restart = 'restart',
    error = 'error',
}

@Component({
    selector: 'app-views-plugins-details',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
    encapsulation: ViewEncapsulation.None
})

export class ViewPluginsDetailsComponent implements AfterContentInit, OnDestroy {

    @Input() public selected: Subject<IPlugin> = new Subject();

    public _ng_plugin: IPlugin | undefined;
    public _ng_state: {
        readme: EReadmeState,
        plugin: EPluginState,
    } = {
        readme: EReadmeState.pending,
        plugin: EPluginState.installed,
    };
    public _ng_error: string | undefined;
    public _ng_dependencies: IDependencyState[] = [];

    private _logger: Toolkit.Logger = new Toolkit.Logger('ViewPluginsPluginComponent');
    private _subscriptions: { [key: string]: Subscription } = {};
    private _destroyed: boolean = false;

    constructor(private _cdRef: ChangeDetectorRef,
        private _notifications: NotificationsService) {
    }

    public ngOnDestroy() {
        this._destroyed = true;
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
        });
    }

    public ngAfterContentInit() {
        this._subscriptions.selected = this.selected.asObservable().subscribe(this._onPluginSelected.bind(this));
        if (this._ng_plugin !== undefined && (this._ng_plugin.readme === undefined || this._ng_plugin.readme.trim() === '')) {
            this._ng_state.readme = EReadmeState.ready;
        }
    }

    public _ng_onLoad() {
        this._ng_state.readme = EReadmeState.ready;
        this._forceUpdate();
    }

    public _ng_onError(event: Error) {
        this._ng_error = event.message;
        this._ng_state.readme = EReadmeState.error;
    }

    public _ng_onInstallPlugin() {
        this._ng_state.plugin = EPluginState.working;
        PluginsService.getManager().install(this._ng_plugin.name).then(() => {
            this._ng_state.plugin = EPluginState.restart;
        }).catch((error: Error) => {
            this._logger.error(`Fail to request downloading of plugin due error: ${error.message}`);
            this._ng_error = error.message;
            this._ng_state.plugin = EPluginState.error;
        }).finally(() => {
            this._forceUpdate();
        });
    }

    public _ng_onRestartPlugin() {
        PluginsService.getManager().restart().then(() => {
            this._logger.debug(`Application will be restarted`);
        }).catch((error: Error) => {
            this._logger.error(`Fail to request restart of application due error: ${error.message}`);
        });
    }

    public _ng_onUninstallPlugin() {
        this._ng_state.plugin = EPluginState.working;
        PluginsService.getManager().uninstall(this._ng_plugin.name).then(() => {
            this._ng_state.plugin = EPluginState.restart;
        }).catch((error: Error) => {
            this._logger.error(`Fail to request uninstall of plugin due error: ${error.message}`);
            this._ng_error = error.message;
            this._ng_state.plugin = EPluginState.error;
        }).finally(() => {
            this._forceUpdate();
        });
    }

    private _onPluginSelected(plugin: IPlugin) {
        if ((this._ng_plugin !== undefined && this._ng_plugin.readme === plugin.readme) ||
            (this._ng_plugin !== undefined && (this._ng_plugin.readme === undefined || this._ng_plugin.readme.trim() === ''))) {
            this._ng_state.readme = EReadmeState.ready;
        } else {
            this._ng_state.readme = EReadmeState.pending;
        }
        this._ng_plugin = plugin;
        this._ng_state.plugin = this._ng_plugin.installed ? EPluginState.installed : EPluginState.notinstalled;
        this._ng_dependencies = getDependenciesStates(plugin.dependencies);
        this._forceUpdate();
    }

    private _forceUpdate() {
        if (this._destroyed) {
            return;
        }
        this._cdRef.detectChanges();
    }

}
