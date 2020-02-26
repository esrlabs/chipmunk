import HotkeysService from '../services/service.hotkeys';
import LayoutStateService from '../services/standalone/service.layout.state';

import PluginsService, { IPluginData } from '../services/service.plugins';
import ServiceElectronIpc, {
    IPCMessages,
    Subscription as IPCSubscription,
} from '../services/service.electron.ipc';

import { ITabAPI } from 'chipmunk-client-complex';
import { Subscription, Observable, Subject } from 'rxjs';
import { ControllerSessionTabStream, IStreamState } from './controller.session.tab.stream';
import { ControllerSessionTabSearch } from './controller.session.tab.search';
import { ControllerSessionTabStates } from './controller.session.tab.states';
import { ControllerSessionTabMap } from './controller.session.tab.map';
import { ControllerSessionTabStreamBookmarks } from './controller.session.tab.stream.bookmarks';
import { ControllerSessionScope } from './controller.session.tab.scope';
import { ControllerSessionTabTitleContextMenu } from './controller.session.tab.titlemenu';
import { TabTitleContentService } from '../layout/area.primary/tab-title-controls/service';

import * as Toolkit from 'chipmunk.client.toolkit';

export { IStreamState };

export interface IControllerSession {
    guid: string;
    sessionsEventsHub: Toolkit.ControllerSessionsEvents;
    tabTitleContentService: TabTitleContentService;
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
    private _stream: ControllerSessionTabStream;
    private _search: ControllerSessionTabSearch;
    private _states: ControllerSessionTabStates;
    private _scope: ControllerSessionScope;
    private _map: ControllerSessionTabMap;
    private _viewportEventsHub: Toolkit.ControllerViewportEvents;
    private _tabAPI: ITabAPI | undefined;
    private _tabTitleContentService: TabTitleContentService;
    private _sourceInfo: IPCMessages.IStreamSourceNew | undefined;
    private _openSourceOptions: any;
    private _titleContextMenu: ControllerSessionTabTitleContextMenu | undefined;
    private _subscriptions: { [key: string]: Subscription | IPCSubscription } = {};
    private _subjects: {
        onOutputInjectionAdd: Subject<IInjectionAddEvent>;
        onOutputInjectionRemove: Subject<IInjectionRemoveEvent>;
    } = {
        onOutputInjectionAdd: new Subject<IInjectionAddEvent>(),
        onOutputInjectionRemove: new Subject<IInjectionRemoveEvent>(),
    };

    constructor(params: IControllerSession) {
        this._sessionId = params.guid;
        this._scope = new ControllerSessionScope(this._sessionId, params.sessionsEventsHub);
        this._logger = new Toolkit.Logger(`ControllerSession: ${params.guid}`);
        this._stream = new ControllerSessionTabStream({
            guid: params.guid,
            scope: this._scope,
        });
        this._search = new ControllerSessionTabSearch({
            guid: params.guid,
            stream: this._stream.getOutputStream(),
            scope: this._scope,
        });
        this._map = new ControllerSessionTabMap({
            guid: params.guid,
            search: this._search,
            stream: this._stream,
        });
        this._states = new ControllerSessionTabStates(params.guid);
        this._viewportEventsHub = new Toolkit.ControllerViewportEvents();
        this.addOutputInjection = this.addOutputInjection.bind(this);
        this.removeOutputInjection = this.removeOutputInjection.bind(this);
        this._tabTitleContentService = params.tabTitleContentService;
        this._subscriptions.onOpenSearchFiltersTab = HotkeysService.getObservable().openSearchFiltersTab.subscribe(
            this._onOpenSearchFiltersTab.bind(this),
        );
    }

    public destroy(): Promise<void> {
        return new Promise((resolve, reject) => {
            Object.keys(this._subscriptions).forEach((key: string) => {
                this._subscriptions[key].unsubscribe();
            });
            ServiceElectronIpc.request(
                new IPCMessages.StreamRemoveRequest({ guid: this.getGuid() }),
                IPCMessages.StreamRemoveResponse,
            )
                .then((response: IPCMessages.StreamRemoveResponse) => {
                    if (response.error) {
                        return reject(
                            new Error(
                                this._logger.warn(
                                    `Fail to destroy session "${this.getGuid()}" due error: ${
                                        response.error
                                    }`,
                                ),
                            ),
                        );
                    }
                    PluginsService.fire().onSessionClose(this._sessionId);
                    this._viewportEventsHub.destroy();
                    Promise.all([
                        this._stream.destroy(),
                        this._search.destroy(),
                        this._states.destroy(),
                    ])
                        .then(() => {
                            this._scope.destroy();
                            resolve();
                        })
                        .catch((error: Error) => {
                            reject(error);
                        });
                })
                .catch((sendingError: Error) => {
                    reject(
                        new Error(
                            this._logger.warn(
                                `Fail to destroy session "${this.getGuid()}" due IPC error: ${
                                    sendingError.message
                                }`,
                            ),
                        ),
                    );
                });
        });
    }

    public init(): Promise<void> {
        return new Promise((resolve, reject) => {
            this._stream
                .init()
                .then(() => {
                    PluginsService.fire().onSessionOpen(this._sessionId);
                    // this._sidebar();
                    resolve();
                })
                .catch((error: Error) => {
                    reject(
                        new Error(
                            this._logger.error(
                                `Fail to init controller due error: ${error.message}`,
                            ),
                        ),
                    );
                });
        });
    }

    public getObservable(): {
        onSourceChanged: Observable<number>;
        onOutputInjectionAdd: Observable<IInjectionAddEvent>;
        onOutputInjectionRemove: Observable<IInjectionRemoveEvent>;
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

    public getScope(): ControllerSessionScope {
        return this._scope;
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

    public getStreamMap(): ControllerSessionTabMap {
        return this._map;
    }

    public getOutputInjections(
        type: Toolkit.EViewsTypes,
    ): Map<string, Toolkit.IComponentInjection> {
        const injections: Map<string, Toolkit.IComponentInjection> = new Map();
        PluginsService.getAvailablePlugins().forEach((plugin: IPluginData) => {
            if (plugin.factories[type] === undefined) {
                return;
            }
            injections.set(plugin.name, {
                id: Toolkit.guid(),
                factory: plugin.factories[type],
                inputs: {
                    ipc: plugin.ipc,
                    session: this._sessionId,
                },
            });
        });
        return injections;
    }

    public getTabTitleContentService(): TabTitleContentService {
        return this._tabTitleContentService;
    }

    public getTabTitleContextMenuService(): ControllerSessionTabTitleContextMenu | undefined {
        return this._titleContextMenu;
    }

    public setSourceInfo(source: IPCMessages.IStreamSourceNew, options: any) {
        this._sourceInfo = source;
        this._openSourceOptions = options;
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

    public resetSessionContent(): Promise<void> {
        return new Promise((resolve, reject) => {
            ServiceElectronIpc.request(
                new IPCMessages.StreamResetRequest({
                    guid: this._sessionId,
                }),
                IPCMessages.StreamResetResponse,
            )
                .then((response: IPCMessages.StreamResetResponse) => {
                    this.getSessionBooksmarks().reset();
                    resolve();
                })
                .catch((error: Error) => {
                    reject(error);
                });
        });
    }

    public setActive() {
        PluginsService.fire().onSessionChange(this._sessionId);
    }

    public setTabAPI(api: ITabAPI | undefined) {
        if (api === undefined || this._titleContextMenu !== undefined) {
            return;
        }
        this._tabAPI = api;
        this._titleContextMenu = new ControllerSessionTabTitleContextMenu(this._sessionId, api);
    }

    public getTabAPI(): ITabAPI | undefined {
        return this._tabAPI;
    }

    private _onOpenSearchFiltersTab() {
        LayoutStateService.sidebarMax();
    }
}
