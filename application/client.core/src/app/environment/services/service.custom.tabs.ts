import { IService } from '../interfaces/interface.service';
import { Subscription } from 'rxjs';
import { TabAboutComponent } from '../components/tabs/about/component';
import { TabPluginsComponent } from '../components/tabs/plugins/component';
import { TabSettingsComponent } from '../components/tabs/settings/component';
import { TabReleaseNotesComponent } from '../components/tabs/release.notes/component';

import ElectronIpcService, { IPC } from './service.electron.ipc';
import TabsSessionsService from './service.sessions.tabs';
import CustomTabsEventsService from './standalone/service.customtabs.events';
import HotkeysService from './service.hotkeys';
import ReleaseNotesService from './service.release.notes';

import * as Toolkit from 'chipmunk.client.toolkit';

const GUIDs = {
    about: `AboutTab:${Toolkit.guid()}`,
    plugins: `PluginsTab:${Toolkit.guid()}`,
    settings: `SettingsTab:${Toolkit.guid()}`,
    release: `ReleaseTab:${Toolkit.guid()}`,
};

export class TabsCustomService implements IService {
    private _logger: Toolkit.Logger = new Toolkit.Logger('TabsCustomService');
    private _subscriptions: { [key: string]: Subscription | Toolkit.Subscription } = {};

    constructor() {}

    public init(): Promise<void> {
        return new Promise((resolve, reject) => {
            this._subscriptions.TabCustomAbout = ElectronIpcService.subscribe(
                IPC.TabCustomAbout,
                this._onTabCustomAbout.bind(this),
            );
            this._subscriptions.TabCustomSettings = ElectronIpcService.subscribe(
                IPC.TabCustomSettings,
                this._onTabCustomSettings.bind(this),
            );
            this._subscriptions.TabCustomPlugins = ElectronIpcService.subscribe(
                IPC.TabCustomPlugins,
                this._onTabCustomPlugins.bind(this),
            );
            this._subscriptions.TabCustomRelease =
                ReleaseNotesService.getObservable().tab.subscribe(
                    this._onTabCustomRelease.bind(this),
                );
            this._subscriptions.plugins = CustomTabsEventsService.getObservable().plugins.subscribe(
                this._onTabCustomPlugins.bind(this),
            );
            this._subscriptions.TabCustomSettingsHotKey =
                HotkeysService.getObservable().settings.subscribe(
                    this._onTabCustomSettings.bind(this),
                );
            resolve();
        });
    }

    public getName(): string {
        return 'TabsCustomService';
    }

    public destroy() {
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
        });
    }

    public about(message: IPC.TabCustomAbout) {
        this._onTabCustomAbout(message);
    }

    public plugins() {
        this._onTabCustomPlugins();
    }

    private _onTabCustomAbout(message: IPC.TabCustomAbout) {
        if (TabsSessionsService.isTabExist(GUIDs.about)) {
            TabsSessionsService.setActive(GUIDs.about);
        } else {
            TabsSessionsService.add({
                id: GUIDs.about,
                title: 'About',
                component: {
                    factory: TabAboutComponent,
                    inputs: {
                        data: message,
                    },
                },
            }).catch((error: Error) => {
                this._logger.warn(`Fail add about tab due error: ${error.message}`);
            });
        }
    }

    private _onTabCustomSettings() {
        if (TabsSessionsService.isTabExist(GUIDs.settings)) {
            TabsSessionsService.setActive(GUIDs.settings);
        } else {
            TabsSessionsService.add({
                id: GUIDs.settings,
                title: 'Settings',
                component: {
                    factory: TabSettingsComponent,
                    inputs: {},
                },
            }).catch((error: Error) => {
                this._logger.warn(`Fail add settings tab due error: ${error.message}`);
            });
        }
    }

    private _onTabCustomPlugins() {
        if (TabsSessionsService.isTabExist(GUIDs.plugins)) {
            TabsSessionsService.setActive(GUIDs.plugins);
        } else {
            TabsSessionsService.add({
                id: GUIDs.plugins,
                title: 'Plugins',
                component: {
                    factory: TabPluginsComponent,
                    inputs: {},
                },
            }).catch((error: Error) => {
                this._logger.warn(`Fail add plugins tab due error: ${error.message}`);
            });
        }
    }

    private _onTabCustomRelease() {
        if (TabsSessionsService.isTabExist(GUIDs.release)) {
            TabsSessionsService.setActive(GUIDs.release);
        } else {
            TabsSessionsService.add({
                id: GUIDs.release,
                title: 'Release Notes',
                component: {
                    factory: TabReleaseNotesComponent,
                    inputs: {},
                },
            }).catch((error: Error) => {
                this._logger.warn(`Fail add release info tab due error: ${error.message}`);
            });
        }
    }
}

export default new TabsCustomService();
