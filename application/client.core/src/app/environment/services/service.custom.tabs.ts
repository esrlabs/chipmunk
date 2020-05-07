import { IService } from '../interfaces/interface.service';
import { Subscription, Subject, Observable } from 'rxjs';
import { TabAboutComponent } from '../components/tabs/about/component';
import { TabPluginsComponent } from '../components/tabs/plugins/component';
import { TabPluginsCounterComponent } from '../components/tabs/plugins/counter/component';
import { TabSettingsComponent } from '../components/tabs/settings/component';

import ElectronIpcService, { IPCMessages } from './service.electron.ipc';
import TabsSessionsService from './service.sessions.tabs';
import CustomTabsEventsService from './standalone/service.customtabs.events';

import * as Toolkit from 'chipmunk.client.toolkit';

export class TabsCustomService implements IService {

    private _logger: Toolkit.Logger = new Toolkit.Logger('TabsCustomService');
    private _subscriptions: { [key: string]: Subscription | Toolkit.Subscription | undefined } = { };

    constructor() {
    }

    public init(): Promise<void> {
        return new Promise((resolve, reject) => {
            this._subscriptions.TabCustomAbout = ElectronIpcService.subscribe(IPCMessages.TabCustomAbout, this._onTabCustomAbout.bind(this));
            this._subscriptions.TabCustomSettings = ElectronIpcService.subscribe(IPCMessages.TabCustomSettings, this._onTabCustomSettings.bind(this));
            this._subscriptions.TabCustomPlugins = ElectronIpcService.subscribe(IPCMessages.TabCustomPlugins, this._onTabCustomPlugins.bind(this));
            this._subscriptions.plugins = CustomTabsEventsService.getObservable().plugins.subscribe(this._onTabCustomPlugins.bind(this));
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

    public about(message: IPCMessages.TabCustomAbout) {
        this._onTabCustomAbout(message);
    }

    public plugins() {
        this._onTabCustomPlugins();
    }

    private _onTabCustomAbout(message: IPCMessages.TabCustomAbout) {
        TabsSessionsService.add({
            id: 'about',
            title: 'About',
            component: {
                factory: TabAboutComponent,
                inputs: {
                    data: message,
                }
            }
        }).catch((error: Error) => {
            this._logger.warn(`Fail add about tab due error: ${error.message}`);
        });
    }

    private _onTabCustomSettings(message: IPCMessages.TabCustomSettings) {
        TabsSessionsService.add({
            id: 'settings',
            title: 'Settings',
            component: {
                factory: TabSettingsComponent,
                inputs: {}
            }
        }).catch((error: Error) => {
            this._logger.warn(`Fail add settings tab due error: ${error.message}`);
        });
    }

    private _onTabCustomPlugins() {
        TabsSessionsService.add({
            id: 'plugins',
            title: 'Plugins',
            component: {
                factory: TabPluginsComponent,
                inputs: { }
            },
            tabCaptionInjection: {
                factory: TabPluginsCounterComponent,
                inputs: { }
            }
        }).catch((error: Error) => {
            this._logger.warn(`Fail add plugins tab due error: ${error.message}`);
        });
    }

}

export default (new TabsCustomService());
