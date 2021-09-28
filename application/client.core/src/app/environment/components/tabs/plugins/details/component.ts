import {
    Component,
    Input,
    OnDestroy,
    ChangeDetectorRef,
    AfterContentInit,
    AfterViewInit,
    ViewEncapsulation,
} from '@angular/core';
import { Subscription, Subject } from 'rxjs';
import {
    IPlugin,
    EPluginState,
    IUpdateUpgradeEvent,
    IStateChangeEvent,
    IViewState,
} from '../../../../controller/controller.plugins.manager';
import { IDependencyState, getDependenciesStates } from '../../../../controller/helpers/versions';
import { NotificationsService } from '../../../../services.injectable/injectable.service.notifications';
import { Storage } from '../../../../controller/helpers/virtualstorage';

import PluginsService from '../../../../services/service.plugins';

import * as Toolkit from 'chipmunk.client.toolkit';

enum EReadmeState {
    ready = 'ready',
    pending = 'pending',
    error = 'error',
}

@Component({
    selector: 'app-views-plugins-details',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
    encapsulation: ViewEncapsulation.None,
})
export class ViewPluginsDetailsComponent implements AfterContentInit, AfterViewInit, OnDestroy {
    @Input() public selected: Subject<IPlugin> = new Subject();

    public _ng_plugin: IPlugin | undefined;
    public _ng_state: {
        readme: EReadmeState;
    } = {
        readme: EReadmeState.pending,
    };
    public _ng_error: string | undefined;
    public _ng_dependencies: IDependencyState[] = [];
    public _ng_version: string | undefined;
    public _ng_versions: string[] = [];

    private _logger: Toolkit.Logger = new Toolkit.Logger('ViewPluginsPluginComponent');
    private _subscriptions: { [key: string]: Subscription } = {};
    private _destroyed: boolean = false;

    constructor(private _cdRef: ChangeDetectorRef, private _notifications: NotificationsService) {}

    public ngOnDestroy() {
        this._destroyed = true;
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
        });
    }

    public ngAfterContentInit() {
        this._subscriptions.selected = this.selected
            .asObservable()
            .subscribe(this._setCurrentPlugin.bind(this));
        this._subscriptions.update = PluginsService.getManager()
            .getObservable()
            .update.subscribe(this._onUpdatePlugin.bind(this));
        this._subscriptions.upgrade = PluginsService.getManager()
            .getObservable()
            .upgrade.subscribe(this._onUpdatePlugin.bind(this));
        this._subscriptions.state = PluginsService.getManager()
            .getObservable()
            .state.subscribe(this._onUpdatePlugin.bind(this));
        if (
            this._ng_plugin !== undefined &&
            (this._ng_plugin.readme === undefined || this._ng_plugin.readme.trim() === '')
        ) {
            this._ng_state.readme = EReadmeState.ready;
        }
    }

    public ngAfterViewInit() {
        this._loadState();
    }

    public _ng_onLoad() {
        this._ng_state.readme = EReadmeState.ready;
        this._forceUpdate();
    }

    public _ng_onError(event: string) {
        this._ng_error = event;
        this._ng_state.readme = EReadmeState.error;
    }

    public _ng_onInstallPlugin() {
        if (this._ng_plugin === undefined || this._ng_version === undefined) {
            return;
        }
        PluginsService.getManager()
            .install(this._ng_plugin.name, this._ng_version)
            .catch((error: Error) => {
                this._logger.error(`Fail to request install of plugin due error: ${error.message}`);
                this._ng_error = error.message;
            })
            .finally(() => {
                this._forceUpdate();
            });
    }

    public _ng_onUpdatePlugin() {
        if (this._ng_plugin === undefined) {
            return;
        }
        if (this._ng_version === this._ng_plugin.version) {
            // Uninstall
            this._ng_onUninstallPlugin();
        } else {
            // Update
            PluginsService.getManager()
                .update(
                    this._ng_plugin.name,
                    this._ng_version === undefined ? 'latest' : this._ng_version,
                )
                .catch((error: Error) => {
                    this._logger.error(
                        `Fail to request update of plugin due error: ${error.message}`,
                    );
                    this._ng_error = error.message;
                })
                .finally(() => {
                    this._forceUpdate();
                });
        }
    }

    public _ng_onUpgradePlugin() {
        if (this._ng_plugin === undefined) {
            return;
        }
        PluginsService.getManager()
            .upgrade(
                this._ng_plugin.name,
                this._ng_version === undefined ? 'latest' : this._ng_version,
            )
            .catch((error: Error) => {
                this._logger.error(`Fail to request upgrade of plugin due error: ${error.message}`);
                this._ng_error = error.message;
            })
            .finally(() => {
                this._forceUpdate();
            });
    }

    public _ng_onRestartPlugin() {
        PluginsService.getManager()
            .restart()
            .then(() => {
                this._logger.debug(`Application will be restarted`);
            })
            .catch((error: Error) => {
                this._logger.error(
                    `Fail to request restart of application due error: ${error.message}`,
                );
            });
    }

    public _ng_onUninstallPlugin() {
        if (this._ng_plugin === undefined) {
            return;
        }
        if (
            this._ng_version === this._ng_plugin.version ||
            this._ng_plugin.state === EPluginState.incompatible
        ) {
            // Uninstall
            PluginsService.getManager()
                .uninstall(this._ng_plugin.name)
                .catch((error: Error) => {
                    this._logger.error(
                        `Fail to request uninstall of plugin due error: ${error.message}`,
                    );
                    this._ng_error = error.message;
                })
                .finally(() => {
                    this._forceUpdate();
                });
        } else {
            // Reinstall
            this._ng_onInstallPlugin();
        }
    }

    public _ng_showVersion(): boolean {
        if (this._ng_plugin === undefined) {
            return false;
        }
        if (
            (this._ng_plugin.state === EPluginState.installed && this._ng_versions.length > 1) ||
            this._ng_plugin.state === EPluginState.notinstalled ||
            this._ng_plugin.state === EPluginState.update ||
            this._ng_plugin.state === EPluginState.upgrade
        ) {
            return true;
        }
        return false;
    }

    public _ng_getUninstallLabel(): string {
        if (this._ng_plugin === undefined) {
            return 'Invalid';
        }
        if (
            this._ng_version === this._ng_plugin.version ||
            this._ng_plugin.state === EPluginState.incompatible
        ) {
            return 'Uninstall';
        } else {
            return 'Apply';
        }
    }

    public _ng_getUpdateLabel(): string {
        if (this._ng_plugin === undefined) {
            return 'Invalid';
        }
        if (this._ng_version === this._ng_plugin.version) {
            return 'Uninstall';
        } else {
            return 'Update';
        }
    }

    public _ng_getErrorLabel(): string {
        if (this._ng_plugin === undefined) {
            return 'Invalid';
        }
        if (!(this._ng_plugin.suitable instanceof Array) || this._ng_plugin.suitable.length === 0) {
            return 'Compatibility';
        }
        return 'Error';
    }

    private _loadState() {
        const view: IViewState = PluginsService.getManager().getStorage().get();
        const plugin: IPlugin | undefined =
            view.selected === undefined
                ? undefined
                : PluginsService.getManager().getByName(view.selected);
        if (plugin === undefined) {
            return;
        }
        this._setCurrentPlugin(plugin);
    }

    private _onUpdatePlugin(event: IUpdateUpgradeEvent | IStateChangeEvent) {
        if (this._ng_plugin === undefined) {
            return;
        }
        if (event.name !== this._ng_plugin.name) {
            return;
        }
        const plugin: IPlugin | undefined = PluginsService.getManager().getByName(
            this._ng_plugin.name,
        );
        if (plugin === undefined) {
            return;
        }
        this._setCurrentPlugin(plugin);
    }

    private _setCurrentPlugin(plugin: IPlugin) {
        if (
            (this._ng_plugin !== undefined && this._ng_plugin.readme === plugin.readme) ||
            (this._ng_plugin !== undefined &&
                (this._ng_plugin.readme === undefined || this._ng_plugin.readme.trim() === ''))
        ) {
            this._ng_state.readme = EReadmeState.ready;
        } else {
            this._ng_state.readme = EReadmeState.pending;
        }
        this._ng_plugin = plugin;
        this._ng_error = undefined;
        this._ng_version = undefined;
        this._ng_versions = [];
        switch (this._ng_plugin.state) {
            case EPluginState.update:
                this._ng_version = this._ng_plugin.update[0];
                this._ng_versions = this._ng_plugin.update;
                break;
            case EPluginState.upgrade:
                this._ng_version = this._ng_plugin.upgrade[0];
                this._ng_versions = this._ng_plugin.upgrade;
                break;
            case EPluginState.installed:
                this._ng_version = plugin.version;
                this._ng_versions = plugin.suitable === undefined ? [] : plugin.suitable;
                break;
            case EPluginState.notinstalled:
                this._ng_version = plugin.suitable === undefined ? undefined : plugin.suitable[0];
                this._ng_versions = plugin.suitable === undefined ? [] : plugin.suitable;
                break;
            case EPluginState.notavailable:
                this._ng_error = `This plugin cannot be installed/updated becaues it isn't compatible to current version of chipmunk. You have two options: wait while developer of plugin will update plugin; update (or downgrade) your chipmunk version.`;
                break;
            case EPluginState.incompatible:
                this._ng_error = `This plugin isn't compatible to your chipmunk version any more. Probably plugin isn't supported as soon as it doesn't have any suitable version in store. You can keep this plugin until update or remove it.`;
                break;
        }
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
