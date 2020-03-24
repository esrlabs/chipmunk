import { Component, OnDestroy, ChangeDetectorRef, AfterViewInit, Input, AfterContentInit, ViewEncapsulation } from '@angular/core';
import { Subscription, Subject, Observable } from 'rxjs';
import { CommonInterfaces } from '../../../../interfaces/interface.common';
import { FormControl } from '@angular/forms';
import { MatAutocompleteSelectedEvent, MatAutocompleteTrigger } from '@angular/material/autocomplete';
import { MatInput } from '@angular/material/input';
import { EManagerState, IPlugin, EUpdateState, IViewState } from '../../../../controller/controller.plugins.manager';
import { Storage } from '../../../../controller/helpers/virtualstorage';

import PluginsService from '../../../../services/service.plugins';

import * as Toolkit from 'chipmunk.client.toolkit';
import { IPCMessages } from 'src/app/environment/interfaces/interface.ipc';

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
        if (PluginsService.getManager().getManagerState() === EManagerState.pending) {
            this._subscriptions.ready = PluginsService.getManager().getObservable().ready.subscribe(this._getPluginsList.bind(this));
        } else {
            this._getPluginsList();
        }
        this._subscriptions.updater = PluginsService.getManager().getObservable().updater.subscribe(this._getUpdaterState.bind(this));
    }

    ngAfterContentInit() {
        this._loadState();
    }

    public ngOnDestroy() {
        this._saveState();
        this._destroyed = true;
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
        });
    }

    public _ng_onPluginClick(plugin: IPlugin) {
        const selected: IPlugin | undefined = PluginsService.getManager().getByName(plugin.name);
        if (selected === undefined){
            return;
        }
        this._ng_selected = selected.name;
        this.selected.next(selected);
        this._forceUpdate();
    }

    public _ng_onDoAllClick() {
        if (PluginsService.getManager().getUpdateState() === EUpdateState.restart) {
            // Do restart
        } else {
            PluginsService.getManager().updateAndUpgradeAll().catch((error: Error) => {
                this._logger.warn(`Fail to update/upgrade all due error: ${error.message}`);
            });
        }
    }

    public _ng_onAddCustom() {
        // TODO
    }

    public _ng_showDoAllButton() {
        return PluginsService.getManager().getCountToBeUpdated() + PluginsService.getManager().getCountToBeUpgraded() > 0;
    }

    public _ng_getBadgeCount(): number {
        if (PluginsService.getManager().getUpdateState() === EUpdateState.restart) {
            return 0;
        } else {
            return PluginsService.getManager().getCountToBeUpdated() + PluginsService.getManager().getCountToBeUpgraded();
        }
    }

    public _ng_getUpdaterState(): EUpdateState {
        return PluginsService.getManager().getUpdateState();
    }

    public _ng_getUpdateButtonCaption(): string {
        if (PluginsService.getManager().getUpdateState() === EUpdateState.working) {
            return 'Working';
        } else if (PluginsService.getManager().getUpdateState() === EUpdateState.restart) {
            return 'Restart';
        } else {
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
    }

    private _saveState() {
        const view: Storage<IViewState> = PluginsService.getManager().getStorage();
        view.set({ selected: this._ng_selected, width: view.get().width });
    }

    private _loadState() {
        const view: Storage<IViewState> = PluginsService.getManager().getStorage();
        this._ng_selected = view.get().selected;
    }

    private _getPluginsList() {
        this._ng_plugins = PluginsService.getManager().getPlugins();
        this._ng_state = EManagerState.ready;
        this._forceUpdate();
    }

    private _getUpdaterState() {
        this._forceUpdate();
    }

    private _forceUpdate() {
        if (this._destroyed) {
            return;
        }
        this._cdRef.detectChanges();
    }

}
