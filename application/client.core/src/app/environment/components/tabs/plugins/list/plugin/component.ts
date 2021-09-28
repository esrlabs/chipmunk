import {
    Component,
    Input,
    OnDestroy,
    ChangeDetectorRef,
    AfterContentInit,
    HostBinding,
    ViewEncapsulation,
} from '@angular/core';
import { Subscription } from 'rxjs';
import {
    IPlugin,
    EPluginState,
    IUpdateUpgradeEvent,
    IStateChangeEvent,
} from '../../../../../controller/controller.plugins.manager';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

import PluginsService from '../../../../../services/service.plugins';

import * as Toolkit from 'chipmunk.client.toolkit';

export interface IPluginData {
    plugin: IPlugin;
    matches: {
        name: string;
        description: string;
    };
}

@Component({
    selector: 'app-views-plugin',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
    encapsulation: ViewEncapsulation.None,
})
export class ViewPluginsPluginComponent implements AfterContentInit, OnDestroy {
    @Input() public data!: IPluginData;
    @Input() public selected!: boolean;

    private _subscriptions: { [key: string]: Subscription } = {};
    private _logger: Toolkit.Logger = new Toolkit.Logger('ViewPluginsPluginComponent');
    private _destroyed: boolean = false;

    @HostBinding('class.selected') get cssClassSelected() {
        return this.selected;
    }

    constructor(private _cdRef: ChangeDetectorRef, private _sanitizer: DomSanitizer) {}

    public ngOnDestroy() {
        this._destroyed = true;
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
        });
    }

    public ngAfterContentInit() {
        this._logger = new Toolkit.Logger(`ViewPluginsPluginComponent (${this.data.plugin.name})`);
        this._subscriptions.update = PluginsService.getManager()
            .getObservable()
            .update.subscribe(this._onUpdatePlugin.bind(this));
        this._subscriptions.upgrade = PluginsService.getManager()
            .getObservable()
            .upgrade.subscribe(this._onUpdatePlugin.bind(this));
        this._subscriptions.state = PluginsService.getManager()
            .getObservable()
            .state.subscribe(this._onUpdatePlugin.bind(this));
    }

    public _ng_getState(): EPluginState {
        return this.data.plugin.state;
    }

    public _ng_getStateLabel(): string {
        if (this.data === undefined) {
            return '';
        }
        switch (this.data.plugin.state) {
            case EPluginState.update:
                return this.data.plugin.update[0];
            case EPluginState.upgrade:
                return this.data.plugin.upgrade[0];
            case EPluginState.installed:
                return 'Installed';
            case EPluginState.working:
                return 'Loading';
            case EPluginState.notavailable:
                return 'Not Compatible';
            case EPluginState.restart:
                return 'Needs restart';
            default:
                return this.data.plugin.version;
        }
    }

    public _ng_getSafeHTML(str: string): SafeHtml {
        return this._sanitizer.bypassSecurityTrustHtml(str);
    }

    private _onUpdatePlugin(event: IUpdateUpgradeEvent | IStateChangeEvent) {
        if (this.data === undefined) {
            return;
        }
        if (event.name !== this.data.plugin.name) {
            return;
        }
        const plugin: IPlugin | undefined = PluginsService.getManager().getByName(
            this.data.plugin.name,
        );
        if (plugin === undefined) {
            return;
        }
        this.data.plugin = plugin;
        this._forceUpdate();
    }

    private _forceUpdate() {
        if (this._destroyed) {
            return;
        }
        this._cdRef.detectChanges();
    }
}
