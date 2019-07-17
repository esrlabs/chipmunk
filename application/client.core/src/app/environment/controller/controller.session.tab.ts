import PluginsService, { IPluginData } from '../services/service.plugins';
import ServiceElectronIpc, { IPCMessages, Subscription as IPCSubscription } from '../services/service.electron.ipc';
import { Subscription, Observable, Subject } from 'rxjs';
import { ControllerSessionTabStream } from './controller.session.tab.stream';
import { ControllerSessionTabSearch } from './controller.session.tab.search';
import { ControllerSessionTabStates } from './controller.session.tab.states';
import { ControllerSessionTabStreamBookmarks } from './controller.session.tab.stream.bookmarks';
import { TabsService } from 'logviewer-client-complex';
import * as Toolkit from 'logviewer.client.toolkit';

export interface IControllerSession {
    guid: string;
    transports: string[];
    defaultsSideBarApps: Array<{ guid: string, name: string, component: any }>;
}

export interface ISidebarTabOptions {
    active?: boolean;
}

export interface IInjectionAddEvent {
    injection: Toolkit.IComponentInjection;
    type: Toolkit.EViewsTypes;
}

export interface IInjectionRemoveEvent {
    id: string;
    type: Toolkit.EViewsTypes;
}

export class ControllerSessionTab {

    private _logger: Toolkit.Logger;
    private _sessionId: string;
    private _transports: string[];
    private _stream: ControllerSessionTabStream;
    private _search: ControllerSessionTabSearch;
    private _states: ControllerSessionTabStates;
    private _viewportEventsHub: Toolkit.ControllerViewportEvents;
    private _sidebarTabsService: TabsService;
    private _defaultsSideBarApps: Array<{ guid: string, name: string, component: any }>;
    private _subscriptions: { [key: string]: Subscription | IPCSubscription } = { };
    private _subjects: {
        onOutputInjectionAdd: Subject<IInjectionAddEvent>,
        onOutputInjectionRemove: Subject<IInjectionRemoveEvent>
    } = {
        onOutputInjectionAdd: new Subject<IInjectionAddEvent>(),
        onOutputInjectionRemove: new Subject<IInjectionRemoveEvent>()
    };

    constructor(params: IControllerSession) {
        this._sessionId = params.guid;
        this._transports = params.transports;
        this._logger = new Toolkit.Logger(`ControllerSession: ${params.guid}`);
        this._stream = new ControllerSessionTabStream({
            guid: params.guid,
            transports: params.transports.slice()
        });
        this._search = new ControllerSessionTabSearch({
            guid: params.guid,
            transports: params.transports.slice(),
            stream: this._stream.getOutputStream()
        });
        this._states = new ControllerSessionTabStates(params.guid);
        this._viewportEventsHub = new Toolkit.ControllerViewportEvents();
        this._defaultsSideBarApps = params.defaultsSideBarApps;
        this._sidebar_update();
        PluginsService.fire().onSessionOpen(this._sessionId);
        this.addOutputInjection = this.addOutputInjection.bind(this);
        this.removeOutputInjection = this.removeOutputInjection.bind(this);
    }

    public destroy(): Promise<void> {
        return new Promise((resolve, reject) => {
            Object.keys(this._subscriptions).forEach((key: string) => {
                this._subscriptions[key].unsubscribe();
            });
            this._viewportEventsHub.destroy();
            this._sidebarTabsService.clear();
            this._sidebarTabsService = undefined;
            Promise.all([
                this._stream.destroy(),
                this._search.destroy(),
                this._states.destroy()
            ]).then(() => {
                ServiceElectronIpc.request(
                    new IPCMessages.StreamRemoveRequest({ guid: this.getGuid() }),
                    IPCMessages.StreamRemoveResponse
                ).then((response: IPCMessages.StreamRemoveResponse) => {
                    if (response.error) {
                        return reject(new Error(this._logger.warn(`Fail to destroy session "${this.getGuid()}" due error: ${response.error}`)));
                    }
                    PluginsService.fire().onSessionClose(this._sessionId);
                    resolve();
                }).catch((sendingError: Error) => {
                    reject(new Error(this._logger.warn(`Fail to destroy session "${this.getGuid()}" due IPC error: ${sendingError.message}`)));
                });
            }).catch((error: Error) => {
                reject(error);
            });
        });
    }

    public getObservable(): {
        onSourceChanged: Observable<number>,
        onOutputInjectionAdd: Observable<IInjectionAddEvent>,
        onOutputInjectionRemove: Observable<IInjectionRemoveEvent>
    } {
        return {
            onSourceChanged: this._stream.getObservable().onSourceChanged,
            onOutputInjectionAdd: this._subjects.onOutputInjectionAdd.asObservable(),
            onOutputInjectionRemove: this._subjects.onOutputInjectionRemove.asObservable(),
        };
    }

    public getGuid(): string {
        return this._sessionId;
    }

    public getSessionStream(): ControllerSessionTabStream {
        return this._stream;
    }

    public getSessionBooksmarks(): ControllerSessionTabStreamBookmarks {
        return this._stream.getBookmarks();
    }

    public getSessionSearch(): ControllerSessionTabSearch {
        return this._search;
    }

    public getSessionsStates(): ControllerSessionTabStates {
        return this._states;
    }

    public getSidebarTabsService(): TabsService {
        return this._sidebarTabsService;
    }

    public getOutputInjections(type: Toolkit.EViewsTypes): Map<string, Toolkit.IComponentInjection> {
        const injections: Map<string, Toolkit.IComponentInjection> = new Map();
        this._transports.forEach((pluginName: string) => {
            const plugin: IPluginData | undefined = PluginsService.getPlugin(pluginName);
            if (plugin === undefined) {
                this._logger.warn(`Plugin "${pluginName}" is defined as transport, but doesn't exist in storage.`);
                return;
            }
            if (plugin.factories[type] === undefined) {
                return;
            }
            injections.set(plugin.name, {
                id: Toolkit.guid(),
                factory: plugin.factories[type],
                inputs: {
                    ipc: plugin.ipc,
                    session: this._sessionId
                }
            });
        });
        return injections;
    }

    public addOutputInjection(injection: Toolkit.IComponentInjection, type: Toolkit.EViewsTypes) {
        this._subjects.onOutputInjectionAdd.next({
            injection: injection,
            type: type,
        });
    }

    public removeOutputInjection(id: string, type: Toolkit.EViewsTypes) {
        this._subjects.onOutputInjectionRemove.next({
            id: id,
            type: type,
        });
    }

    public getViewportEventsHub(): Toolkit.ControllerViewportEvents {
        return this._viewportEventsHub;
    }

    public addSidebarApp(name: string, component: any, inputs: { [key: string]: any }, options?: ISidebarTabOptions): string {
        if (options === undefined) {
            options = {};
        }
        // Set defaut options
        options.active = typeof options.active === 'boolean' ? options.active : true;
        // Create tab guid
        const guid: string = Toolkit.guid();
        // Add sidebar tab
        this._sidebarTabsService.add({
            guid: guid,
            name: name,
            active: options.active,
            content: {
                factory: component,
                inputs: inputs
            }
        });
        return guid;
    }

    public openSidebarTab(guid: string): void {
        this._sidebarTabsService.setActive(guid);
    }

    public removeSidebarApp(guid: string): void {
        this._sidebarTabsService.remove(guid);
    }

    public resetSessionContent(): Promise<void> {
        return new Promise((resolve, reject) => {
            ServiceElectronIpc.request(new IPCMessages.StreamResetRequest({
                guid: this._sessionId,
            }), IPCMessages.StreamResetResponse).then((response: IPCMessages.StreamResetResponse) => {
                this.getSessionBooksmarks().reset();
                resolve();
            }).catch((error: Error) => {
                reject(error);
            });
        });
    }

    public setActive() {
        PluginsService.fire().onSessionChange(this._sessionId);
    }

    private _sidebar_update() {
        if (this._sidebarTabsService !== undefined) {
            // Drop previous if was defined
            this._sidebarTabsService.clear();
        }
        // Create new tabs service
        this._sidebarTabsService = new TabsService();
        // Add default sidebar apps
        this._defaultsSideBarApps.forEach((app, index) => {
            // Add tab to sidebar
            this._sidebarTabsService.add({
                guid: app.guid !== undefined ? app.guid : Toolkit.guid(),
                name: app.name,
                active: index === 0,
                closable: false,
                content: {
                    factory: app.component,
                    resolved: false,
                    inputs: {
                        session: this._sessionId,
                    }
                }
            });
        });
        // Detect tabs related to transports (plugins)
        this._transports.forEach((pluginName: string, index: number) => {
            const plugin: IPluginData | undefined = PluginsService.getPlugin(pluginName);
            if (plugin === undefined) {
                this._logger.warn(`Plugin "${pluginName}" is defined as transport, but doesn't exist in storage.`);
                return;
            }
            if (plugin.factories[Toolkit.EViewsTypes.sidebarVertical] === undefined) {
                return;
            }
            // Add tab to sidebar
            this._sidebarTabsService.add({
                guid: Toolkit.guid(),
                name: plugin.name,
                active: false,
                content: {
                    factory: plugin.factories[Toolkit.EViewsTypes.sidebarVertical],
                    resolved: true,
                    inputs: {
                        session: this._sessionId,
                        ipc: plugin.ipc,
                        sessions: plugin.controllers.sessions,
                    }
                }
            });
        });
    }

}
