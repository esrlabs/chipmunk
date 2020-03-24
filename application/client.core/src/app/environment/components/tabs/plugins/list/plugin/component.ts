import { Component, Input, OnDestroy, ChangeDetectorRef, AfterContentInit, HostBinding } from '@angular/core';
import { Subscription, Subject } from 'rxjs';
import { IPlugin, EPluginState, IUpdateUpgradeEvent, IStateChangeEvent } from '../../../../../controller/controller.plugins.manager';

import PluginsService from '../../../../../services/service.plugins';

import * as Toolkit from 'chipmunk.client.toolkit';

@Component({
    selector: 'app-views-plugin',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})

export class ViewPluginsPluginComponent implements AfterContentInit, OnDestroy {

    @Input() public plugin: IPlugin;
    @Input() public selected: boolean;

    private _subscriptions: { [key: string]: Subscription } = {};
    private _logger: Toolkit.Logger = new Toolkit.Logger('ViewPluginsPluginComponent');
    private _destroyed: boolean = false;

    @HostBinding('class.selected') get cssClassSelected() {
        return this.selected;
    }

    constructor(private _cdRef: ChangeDetectorRef ) {
    }

    public ngOnDestroy() {
        this._destroyed = true;
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
        });
    }

    public ngAfterContentInit() {
        this._logger = new Toolkit.Logger(`ViewPluginsPluginComponent (${this.plugin.name})`);
        this._subscriptions.update = PluginsService.getManager().getObservable().update.subscribe(this._onUpdatePlugin.bind(this));
        this._subscriptions.upgrade = PluginsService.getManager().getObservable().upgrade.subscribe(this._onUpdatePlugin.bind(this));
        this._subscriptions.state = PluginsService.getManager().getObservable().state.subscribe(this._onUpdatePlugin.bind(this));
    }

    public _ng_getState(): EPluginState {
        return this.plugin.state;
    }

    public _ng_getStateLabel(): string {
        if (this.plugin === undefined) {
            return '';
        }
        switch (this.plugin.state) {
            case EPluginState.update:
                return this.plugin.update[0];
            case EPluginState.upgrade:
                return this.plugin.upgrade[0];
            case EPluginState.installed:
                return 'Installed';
            case EPluginState.working:
                return 'Loading';
            case EPluginState.notavailable:
                return 'Not Compatible';
            case EPluginState.restart:
                return 'Needs restart';
            default:
                return this.plugin.version;
        }
    }

    private _onUpdatePlugin(event: IUpdateUpgradeEvent |IStateChangeEvent) {
        if (this.plugin === undefined) {
            return;
        }
        if (event.name !== this.plugin.name) {
            return;
        }
        const plugin: IPlugin | undefined = PluginsService.getManager().getByName(this.plugin.name);
        if (plugin === undefined) {
            return;
        }
        this.plugin = plugin;
        this._forceUpdate();
    }

    private _forceUpdate() {
        if (this._destroyed) {
            return;
        }
        this._cdRef.detectChanges();
    }

}
