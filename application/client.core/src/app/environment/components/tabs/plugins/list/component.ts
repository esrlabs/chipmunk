import {
    Component,
    OnDestroy,
    ChangeDetectorRef,
    AfterViewInit,
    Input,
    AfterContentInit,
    ViewEncapsulation,
} from '@angular/core';
import { Subscription, Subject, Observable } from 'rxjs';
import {
    EManagerState,
    IPlugin,
    EUpdateState,
    IViewState,
} from '../../../../controller/controller.plugins.manager';
import { Storage } from '../../../../controller/helpers/virtualstorage';
import { NotificationsService } from '../../../../services.injectable/injectable.service.notifications';
import { sortPairs, IPair } from '../../../../thirdparty/code/engine';
import { IPluginData } from './plugin/component';

import PluginsService from '../../../../services/service.plugins';

import * as Toolkit from 'chipmunk.client.toolkit';

@Component({
    selector: 'app-views-plugins-list',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
    encapsulation: ViewEncapsulation.None,
})
export class ViewPluginsListComponent implements OnDestroy, AfterViewInit, AfterContentInit {
    @Input() public selected: Subject<IPlugin> = new Subject();

    public _ng_plugins: IPluginData[] = [];
    public _ng_state: EManagerState = EManagerState.pending;
    public _ng_selected: string | undefined;
    public _ng_search: string = '';

    private _subscriptions: { [key: string]: Subscription } = {};
    private _destroyed: boolean = false;
    private _logger: Toolkit.Logger = new Toolkit.Logger('ViewPluginsListComponent');
    private _plugins: IPlugin[] = [];

    constructor(private _cdRef: ChangeDetectorRef, private _notifications: NotificationsService) {}

    ngAfterViewInit() {
        if (PluginsService.getManager().getManagerState() === EManagerState.pending) {
            this._subscriptions.ready = PluginsService.getManager()
                .getObservable()
                .ready.subscribe(this._getPluginsList.bind(this));
        } else {
            this._getPluginsList();
        }
        this._subscriptions.updater = PluginsService.getManager()
            .getObservable()
            .updater.subscribe(this._forceUpdate.bind(this));
        this._subscriptions.custom = PluginsService.getManager()
            .getObservable()
            .custom.subscribe(this._forceUpdate.bind(this));
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
        if (selected === undefined) {
            return;
        }
        this._ng_selected = selected.name;
        this.selected.next(selected);
        this._forceUpdate();
    }

    public _ng_onDoAllClick() {
        if (PluginsService.getManager().getUpdateState() === EUpdateState.restart) {
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
        } else {
            PluginsService.getManager()
                .updateAndUpgradeAll()
                .catch((error: Error) => {
                    this._logger.warn(`Fail to update/upgrade all due error: ${error.message}`);
                });
        }
    }

    public _ng_onAddCustom() {
        if (PluginsService.getManager().getCustomState() === EUpdateState.restart) {
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
        } else {
            PluginsService.getManager()
                .custom()
                .catch((error: Error) => {
                    this._notifications.add({
                        caption: 'Plugin Error',
                        message: `Fail install custom plugin due error: ${error.message}`,
                    });
                });
        }
    }

    public _ng_showDoAllButton() {
        return PluginsService.getManager().getCountToBeUpgradedUpdated() > 0;
    }

    public _ng_getBadgeCount(): number {
        if (PluginsService.getManager().getUpdateState() === EUpdateState.restart) {
            return 0;
        } else {
            return PluginsService.getManager().getCountToBeUpgradedUpdated();
        }
    }

    public _ng_getUpdaterState(): EUpdateState {
        return PluginsService.getManager().getUpdateState();
    }

    public _ng_getCustomState(): EUpdateState {
        return PluginsService.getManager().getCustomState();
    }

    public _ng_getUpdateButtonCaption(): string {
        if (PluginsService.getManager().getUpdateState() === EUpdateState.working) {
            return 'Working';
        } else if (PluginsService.getManager().getUpdateState() === EUpdateState.restart) {
            return 'Restart';
        } else {
            if (
                PluginsService.getManager().getCountToBeUpdated() > 0 &&
                PluginsService.getManager().getCountToBeUpgraded() > 0
            ) {
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

    public _ng_getAddCustomCaption(): string {
        if (PluginsService.getManager().getCustomState() === EUpdateState.working) {
            return 'Working';
        } else if (PluginsService.getManager().getCustomState() === EUpdateState.restart) {
            return 'Restart';
        } else {
            return 'Add Local Plugin';
        }
    }

    public _ng_onSearchChange(value: string) {
        this._ng_plugins = this._getSortedPlugins(this._ng_search);
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
        this._plugins = PluginsService.getManager().getPlugins();
        this._ng_plugins = this._getSortedPlugins('');
        this._ng_state = EManagerState.ready;
        this._forceUpdate();
    }

    private _getSortedPlugins(search: string): IPluginData[] {
        if (search === '') {
            return this._plugins.map((plugin: IPlugin) => {
                return {
                    plugin: plugin,
                    matches: {
                        name: plugin.display_name,
                        description: plugin.description,
                    },
                };
            });
        }
        const pairs: IPair[] = this._plugins.map((plugin: IPlugin) => {
            return {
                id: plugin.name,
                caption: plugin.display_name,
                description: plugin.description,
            };
        });
        const scored = sortPairs(pairs, search, search !== '', 'span');
        const plugins: IPluginData[] = [];
        scored.forEach((s: IPair) => {
            const found: IPlugin | undefined = this._plugins.find((p) => p.name === s.id);
            if (found === undefined) {
                return;
            }
            plugins.push({
                plugin: found,
                matches: {
                    name: s.tcaption === undefined ? s.caption : s.tcaption,
                    description: s.tdescription === undefined ? s.description : s.tdescription,
                },
            });
        });
        return plugins;
    }

    private _forceUpdate() {
        if (this._destroyed) {
            return;
        }
        this._cdRef.detectChanges();
    }
}
