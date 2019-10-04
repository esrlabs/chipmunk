import { TabsService, IComponentDesc, ITab } from 'logviewer-client-complex';
import { Subscription, Subject, Observable } from 'rxjs';
import * as Toolkit from 'logviewer.client.toolkit';
import { IService } from '../interfaces/interface.service';
import ControllerPluginIPC from '../controller/controller.plugin.ipc';
import TabsSessionsService from './service.sessions.tabs';
import { ControllerSessionTab } from '../controller/controller.session.tab';
import PluginsService, { IPluginData } from '../services/service.plugins';

export interface ISidebarPluginInfo {
    id: number;
    name: string;
    factory: any;
    ipc: ControllerPluginIPC;
}

export class SidebarSessionsService implements IService {

    private _logger: Toolkit.Logger = new Toolkit.Logger('SidebarSessionsService');
    private _services: Map<string, TabsService> = new Map();
    private _subscriptions: { [key: string]: Subscription | Toolkit.Subscription } = {};
    private _inputs: { [key: string]: any } = {};
    private _defaults: ITab[];
    private _injected: IComponentDesc | undefined;
    private _subjects: {
        injection: Subject<IComponentDesc | undefined>,
    } = {
        injection: new Subject<IComponentDesc | undefined>(),
    };

    constructor() {
        this._subscriptions.onSessionChange = TabsSessionsService.getObservable().onSessionChange.subscribe(this._onSessionChange.bind(this));
    }

    public init(): Promise<void> {
        return new Promise((resolve, reject) => {
            resolve();
        });
    }

    public getName(): string {
        return 'SidebarSessionsService';
    }

    public destroy() {
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
        });
        this._services.forEach((serivce: TabsService) => {
            serivce.clear();
        });
        this._services.clear();
    }

    public setDefaultsApps(tabs: ITab[]) {
        this._defaults = tabs;
    }

    public getTabsService(session: string): TabsService | undefined {
        return this._services.get(session);
    }

    public setCommonInputs(inputs: { [key: string]: any }) {
        this._inputs = inputs;
    }

    public add(tabs: ITab[] | ITab, session?: string) {
        tabs = tabs instanceof Array ? tabs : [tabs];
        // Add tabs
        tabs.forEach((tab: ITab) => {
            this._add(tab, session);
        });
    }

    public remove(tab: string, session?: string): Error | undefined {
        const service: TabsService | Error = this._getSessionTabsService(session);
        if (service instanceof Error) {
            return service;
        }
        service.remove(tab);
    }

    public has(tab: string, session?: string): boolean {
        const service: TabsService | undefined = this._services.get(
            session === undefined ? this._getActiveSessionGuid() : session
        );
        if (service === undefined) {
            return false;
        }
        return service.has(tab);
    }

    public setActive(tab: string, session?: string): Error | undefined {
        const service: TabsService | Error = this._getSessionTabsService(session);
        if (service instanceof Error) {
            return service;
        }
        service.setActive(tab);
    }

    public getObservable(): {
        injection: Observable<IComponentDesc | undefined>
    } {
        return {
            injection: this._subjects.injection.asObservable()
        };
    }

    public setTitleInjection(comp: IComponentDesc | undefined) {
        if (comp === undefined && this._injected === undefined) {
            return;
        }
        if (comp !== undefined && this._injected !== undefined && comp.factory !== undefined && this._injected.factory !== undefined) {
            if (typeof comp.factory.name === 'string' && typeof this._injected.factory.name === 'string') {
                if (comp.factory.name === this._injected.factory.name && Object.keys(comp.inputs).length === Object.keys(this._injected.inputs).length) {
                    return;
                }
            }
        }
        this._injected = comp;
        this._subjects.injection.next(comp);
    }

    private _create(session: string, transports: string[]) {
        // Create new tabs service
        this._services.set(session, new TabsService());
        // Add default sidebar apps
        this._defaults.forEach((tab: ITab, index) => {
            tab.active = index === 0;
            // Add tab to sidebar
            this._add(tab, session);
        });
        // Detect tabs related to transports (plugins)
        transports.forEach((transport: string, index: number) => {
            const plugin: IPluginData | undefined = PluginsService.getPlugin(transport);
            if (plugin === undefined) {
                this._logger.warn(`Plugin "${transport}" is defined as transport, but doesn't exist in storage.`);
                return;
            }
            if (plugin.factories[Toolkit.EViewsTypes.sidebarVertical] === undefined) {
                return;
            }
            // Add tab to sidebar
            this._add({
                guid: Toolkit.guid(),
                name: plugin.name,
                active: false,
                content: {
                    factory: plugin.factories[Toolkit.EViewsTypes.sidebarVertical],
                    resolved: true,
                    inputs: {
                        session: session,
                        api: TabsSessionsService.getPluginAPI(plugin.id),
                        sessions: plugin.controllers.sessions,
                    }
                }
            }, session);
        });
    }

    private _add(tab: ITab, session: string): Error | string {
        if (typeof tab !== 'object' || tab === null) {
            return;
        }
        // Change storage of service
        const service: TabsService | Error = this._getSessionTabsService(session);
        if (service instanceof Error) {
            return service;
        }
        // Get verified session guid
        session = this._verifySessionGuid(session);
        // Add guid of tab if isn't defiend
        if (tab.guid === undefined) {
            tab.guid = Toolkit.guid();
        }
        // Add default inputs
        tab.content.inputs = Object.assign(tab.content.inputs, this._inputs);
        // Add session guid if missed
        if (tab.content.inputs.session === undefined) {
            tab.content.inputs.session = session;
        }
        // Add tab
        service.add(tab);
        // Save service
        this._services.set(session, service);
        return tab.guid;
    }

    private _getActiveSessionGuid(): string | undefined {
        const session = TabsSessionsService.getActive();
        return session === undefined ? undefined : session.getGuid();
    }

    private _verifySessionGuid(session?: string): string | undefined {
        return session === undefined ? this._getActiveSessionGuid() : session;
    }

    private _getSessionTabsService(session?: string): Error | TabsService {
        const service: TabsService | undefined = this._services.get(
            this._verifySessionGuid(session)
        );
        if (service === undefined) {
            return new Error(this._logger.warn(`Fail to get tab's service for session "${session}"`));
        }
        return service;
    }

    private _onSessionChange(controller: ControllerSessionTab) {
        if (controller === undefined) {
            return;
        }
        // Create
        this._create(controller.getGuid(), controller.getTransports());
    }

}

/*
        SidebarSessionsService.setActive('search');

*/

export default (new SidebarSessionsService());
