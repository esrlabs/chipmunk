import { Component, OnDestroy, ChangeDetectorRef, ViewContainerRef, AfterViewInit, ViewChild, Input, AfterContentInit, ViewEncapsulation } from '@angular/core';
import { Subscription, Subject, Observable } from 'rxjs';
import { CommonInterfaces } from '../../../../interfaces/interface.common';
import { IPlugin } from './plugin/component';
import { FormControl } from '@angular/forms';
import { MatAutocompleteSelectedEvent, MatAutocompleteTrigger } from '@angular/material/autocomplete';
import { MatInput } from '@angular/material/input';

import PluginsService from '../../../../services/service.plugins';

import * as Toolkit from 'chipmunk.client.toolkit';

@Component({
    selector: 'app-views-plugins-list',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
    encapsulation: ViewEncapsulation.None
})

export class ViewPluginsListComponent implements OnDestroy, AfterViewInit, AfterContentInit {

    public _ng_plugins: IPlugin[] = [];
    public _ng_searchInputCtrl = new FormControl();

    private _subscriptions: { [key: string]: Subscription | undefined } = { };
    private _destroyed: boolean = false;
    private _logger: Toolkit.Logger = new Toolkit.Logger('ViewPluginsListComponent');

    constructor(private _cdRef: ChangeDetectorRef,
                private _vcRef: ViewContainerRef) {

    }

    ngAfterViewInit() {
        Promise.all([
            PluginsService.getInstalledPluginsInfo().catch((error: Error) => {
                this._logger.warn(`Fail get list of installed plugins due error: ${error.message}`);
                return Promise.resolve([]);
            }),
            PluginsService.getAvailablePluginsInfo().catch((error: Error) => {
                this._logger.warn(`Fail get list of available plugins due error: ${error.message}`);
                return Promise.resolve([]);
            }),
        ]).then((results: Array<CommonInterfaces.Plugins.IPlugin[]>) => {
            const installed: CommonInterfaces.Plugins.IPlugin[] = results[0];
            const available: CommonInterfaces.Plugins.IPlugin[] = results[1];
            this._ng_plugins = available.map((p: CommonInterfaces.Plugins.IPlugin) => {
                (p as IPlugin).installed = false;
                installed.forEach((plugin: CommonInterfaces.Plugins.IPlugin) => {
                    if (p.name === plugin.name) {
                        p = plugin;
                        (p as IPlugin).installed = true;
                    }
                });
                return p as IPlugin;
            });
            this._ng_plugins.sort((a) => {
                return a.installed ? -1 : 1;
            });
            this._forceUpdate();
        });
    }

    ngAfterContentInit() {

    }

    public ngOnDestroy() {
        this._destroyed = true;
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
        });
    }

    private _forceUpdate() {
        if (this._destroyed) {
            return;
        }
        this._cdRef.detectChanges();
    }

}
