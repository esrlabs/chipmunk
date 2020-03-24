import { Component, OnDestroy, ChangeDetectorRef, AfterViewInit, Input, AfterContentInit, ViewEncapsulation } from '@angular/core';
import { Subscription, Subject, Observable } from 'rxjs';
import { CommonInterfaces } from '../../../../interfaces/interface.common';
import { FormControl } from '@angular/forms';
import { MatAutocompleteSelectedEvent, MatAutocompleteTrigger } from '@angular/material/autocomplete';
import { MatInput } from '@angular/material/input';
import { EManagerState, IPlugin } from '../../../../controller/controller.plugins.manager';

import PluginsService from '../../../../services/service.plugins';

import * as Toolkit from 'chipmunk.client.toolkit';

@Component({
    selector: 'app-views-plugins-list',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
    encapsulation: ViewEncapsulation.None
})

export class ViewPluginsListComponent implements OnDestroy, AfterViewInit, AfterContentInit {

    @Input() public selected: Subject<IPlugin> = new Subject();

    public _ng_plugins: IPlugin[] = [];
    public _ng_searchInputCtrl = new FormControl();
    public _ng_state: EManagerState = EManagerState.pending;
    public _ng_selected: string | undefined;

    private _subscriptions: { [key: string]: Subscription | undefined } = { };
    private _destroyed: boolean = false;
    private _logger: Toolkit.Logger = new Toolkit.Logger('ViewPluginsListComponent');

    constructor(private _cdRef: ChangeDetectorRef) {

    }

    ngAfterViewInit() {
        if (PluginsService.getManager().getState() === EManagerState.pending) {
            this._subscriptions.onPluginsManagerReady = PluginsService.getManager().getObservable().ready.subscribe(this._getPluginsList.bind(this));
        } else {
            this._getPluginsList();
        }
    }

    ngAfterContentInit() {

    }

    public ngOnDestroy() {
        this._destroyed = true;
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
        });
    }

    public _ng_onPluginClick(plugin: IPlugin) {
        this._ng_selected = plugin.name;
        this.selected.next(plugin);
        this._forceUpdate();
    }

    public _ng_onDoAllClick() {

    }

    public _ng_onAddCustom() {
        
    }

    public _ng_showDoAllButton() {
        return PluginsService.getManager().getCountToBeUpdated() + PluginsService.getManager().getCountToBeUpgraded() > 0;
    }

    public _ng_getBadgeCount(): number {
        return PluginsService.getManager().getCountToBeUpdated() + PluginsService.getManager().getCountToBeUpgraded();
    }

    public _ng_getUpdateButtonCaption(): string {
        if (PluginsService.getManager().getCountToBeUpdated() > 0 && PluginsService.getManager().getCountToBeUpgraded() > 0) {
            return 'Upgrade & Update All';
        } else if (PluginsService.getManager().getCountToBeUpdated() > 0) {
            return 'Update All';
        } else if (PluginsService.getManager().getCountToBeUpgraded() > 0) {
            return 'Upgrade All';
        } else {
            return '';
        }
    }

    private _getPluginsList() {
        this._ng_plugins = PluginsService.getManager().getPlugins();
        this._ng_state = EManagerState.ready;
        this._forceUpdate();
    }

    private _forceUpdate() {
        if (this._destroyed) {
            return;
        }
        this._cdRef.detectChanges();
    }

}
