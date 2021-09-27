import HotkeysService from '../../services/service.hotkeys';
import LayoutStateService from '../../services/standalone/service.layout.state';

import PluginsService, { IPluginData } from '../../services/service.plugins';
import ServiceElectronIpc, {
    IPC,
    Subscription as IPCSubscription,
} from '../../services/service.electron.ipc';

import { ITabAPI } from 'chipmunk-client-material';
import { IAPI } from 'chipmunk.client.toolkit';
import { Subscription, Observable, Subject } from 'rxjs';
import {
    ControllerSessionTabStream,
    IStreamState,
} from './dependencies/stream/controller.session.tab.stream';
import { ControllerSessionTabSearch } from './dependencies/search/controller.session.tab.search';
import { ControllerSessionTabStates } from './dependencies/states/controller.session.tab.states';
import { ControllerSessionTabMap } from './dependencies/map/controller.session.tab.map';
import { ControllerSessionTabStreamBookmarks } from './dependencies/bookmarks/controller.session.tab.stream.bookmarks';
import { ControllerSessionScope } from './dependencies/scope/controller.session.tab.scope';
import { ControllerSessionTabTitleContextMenu } from '../controller.session.tab.titlemenu';

import { ControllerSessionTabTimestamp } from './dependencies/timestamps/session.dependency.timestamps';
import { ControllerSessionTabStreamComments } from './dependencies/comments/session.dependency.comments';
import { ControllerRowAPI } from './dependencies/row/controller.row.api';
import { ControllerSessionTabStreamOutput } from './dependencies/output/controller.session.tab.stream.output';

import { ControllerSessionImporter } from './dependencies/importer/controller.session.importer';
import { Importable } from './dependencies/importer/controller.session.importer.interface';
import { Dependency, DependencyConstructor } from './dependencies/session.dependency';

import * as Toolkit from 'chipmunk.client.toolkit';

export { IStreamState };

export interface IControllerSession {
    guid: string;
    api: IAPI;
    sessionsEventsHub: Toolkit.ControllerSessionsEvents;
}

export interface IInjectionAddEvent {
    injection: Toolkit.IComponentInjection;
    type: Toolkit.EViewsTypes;
    silence: boolean;
}

export interface IInjectionRemoveEvent {
    id: string;
    type: Toolkit.EViewsTypes;
}

export class Session {
    private _logger: Toolkit.Logger;
    private _sessionId: string;
    private _dependencies: {
        timestamp: ControllerSessionTabTimestamp | undefined;
        comments: ControllerSessionTabStreamComments | undefined;
        map: ControllerSessionTabMap | undefined;
        scope: ControllerSessionScope | undefined;
        stream: ControllerSessionTabStream | undefined;
        search: ControllerSessionTabSearch | undefined;
        states: ControllerSessionTabStates | undefined;
        importer: ControllerSessionImporter | undefined;
        rowapi: ControllerRowAPI | undefined;
        output: ControllerSessionTabStreamOutput | undefined;
        bookmarks: ControllerSessionTabStreamBookmarks | undefined;
    } = {
        timestamp: undefined,
        comments: undefined,
        map: undefined,
        scope: undefined,
        stream: undefined,
        search: undefined,
        states: undefined,
        importer: undefined,
        rowapi: undefined,
        output: undefined,
        bookmarks: undefined,
    };
    private _viewportEventsHub: Toolkit.ControllerViewportEvents;
    private _tabAPI: ITabAPI | undefined;
    private _sessionsEventsHub: Toolkit.ControllerSessionsEvents;
    private _titleContextMenu: ControllerSessionTabTitleContextMenu | undefined;
    private _subscriptions: { [key: string]: Subscription | IPCSubscription } = {};
    private _api: IAPI;
    private _subjects: {
        onOutputInjectionAdd: Subject<IInjectionAddEvent>;
        onOutputInjectionRemove: Subject<IInjectionRemoveEvent>;
    } = {
        onOutputInjectionAdd: new Subject<IInjectionAddEvent>(),
        onOutputInjectionRemove: new Subject<IInjectionRemoveEvent>(),
    };

    constructor(params: IControllerSession) {
        this._sessionId = params.guid;
        this._api = params.api;
        this._sessionsEventsHub = params.sessionsEventsHub;
        this._logger = new Toolkit.Logger(`ControllerSession: ${params.guid}`);
        this._viewportEventsHub = new Toolkit.ControllerViewportEvents();
        this.addOutputInjection = this.addOutputInjection.bind(this);
        this.removeOutputInjection = this.removeOutputInjection.bind(this);
        this._subscriptions.onOpenSearchFiltersTab =
            HotkeysService.getObservable().openSearchFiltersTab.subscribe(
                this._onOpenSearchFiltersTab.bind(this),
            );
        PluginsService.fire().onSessionOpen(this._sessionId);
    }

    public init(): Promise<void> {
        return new Promise((resolve, reject) => {
            function factory<T>(self: Session, Dep: DependencyConstructor<T>): Dependency & T {
                return new Dep(self._sessionId, () => self);
            }
            function init<T>(self: Session, dependency: Dependency & T): Promise<void> {
                return new Promise((res, rej) => {
                    self._logger.debug(
                        `Initing ${dependency.getName()} for session ${self._sessionId}`,
                    );
                    dependency
                        .init()
                        .then(() => {
                            self._logger.debug(`${dependency.getName()} inited successfully`);
                            res();
                        })
                        .catch((err: Error) => {
                            rej(
                                new Error(
                                    self._logger.error(
                                        `Fail to init ${dependency.getName()} due error: ${
                                            err.message
                                        }`,
                                    ),
                                ),
                            );
                        });
                });
            }
            this._dependencies.timestamp = factory<ControllerSessionTabTimestamp>(
                this,
                ControllerSessionTabTimestamp,
            );
            this._dependencies.stream = factory<ControllerSessionTabStream>(
                this,
                ControllerSessionTabStream,
            );
            this._dependencies.search = factory<ControllerSessionTabSearch>(
                this,
                ControllerSessionTabSearch,
            );
            this._dependencies.comments = factory<ControllerSessionTabStreamComments>(
                this,
                ControllerSessionTabStreamComments,
            );
            this._dependencies.map = factory<ControllerSessionTabMap>(
                this,
                ControllerSessionTabMap,
            );
            this._dependencies.scope = factory<ControllerSessionScope>(
                this,
                ControllerSessionScope,
            );
            this._dependencies.states = factory<ControllerSessionTabStates>(
                this,
                ControllerSessionTabStates,
            );
            this._dependencies.importer = factory<ControllerSessionImporter>(
                this,
                ControllerSessionImporter,
            );
            this._dependencies.rowapi = factory<ControllerRowAPI>(this, ControllerRowAPI);
            this._dependencies.output = factory<ControllerSessionTabStreamOutput>(
                this,
                ControllerSessionTabStreamOutput,
            );
            this._dependencies.bookmarks = factory<ControllerSessionTabStreamBookmarks>(
                this,
                ControllerSessionTabStreamBookmarks,
            );
            Promise.all([
                init<ControllerSessionTabTimestamp>(this, this._dependencies.timestamp),
                init<ControllerSessionTabStream>(this, this._dependencies.stream),
                init<ControllerSessionTabSearch>(this, this._dependencies.search),
                init<ControllerSessionTabStreamComments>(this, this._dependencies.comments),
                init<ControllerSessionTabMap>(this, this._dependencies.map),
                init<ControllerSessionScope>(this, this._dependencies.scope),
                init<ControllerSessionTabStates>(this, this._dependencies.states),
                init<ControllerSessionImporter>(this, this._dependencies.importer),
                init<ControllerRowAPI>(this, this._dependencies.rowapi),
                init<ControllerSessionTabStreamOutput>(this, this._dependencies.output),
                init<ControllerSessionTabStreamBookmarks>(this, this._dependencies.bookmarks),
            ])
                .then(() => {
                    this._logger.debug(`Session "${this._sessionId}" is created`);
                    resolve();
                })
                .catch(reject);
        });
    }

    public destroy(): Promise<void> {
        return new Promise((resolve, reject) => {
            Object.keys(this._subscriptions).forEach((key: string) => {
                this._subscriptions[key].unsubscribe();
            });
            ServiceElectronIpc.request<IPC.StreamRemoveResponse>(
                new IPC.StreamRemoveRequest({ guid: this.getGuid() }),
                IPC.StreamRemoveResponse,
            )
                .then((response) => {
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
                    Promise.all(
                        Object.keys(this._dependencies).map((key: string) => {
                            const dep = (this._dependencies as any)[key];
                            if (dep === undefined || typeof dep.destroy !== 'function') {
                                this._logger.error(`Fail to get correct dependency holder; name = ${key}`);
                                return Promise.resolve();
                            } else {
                                return dep.destroy().catch((err: Error) => {
                                    this._logger.warn(
                                        `Fail correctly destroy dependency "${dep.getName()}" due error: ${
                                            err.message
                                        }`,
                                    );
                                });
                            }
                        }),
                    )
                        .then(() => {
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

    public getObservable(): {
        onSourceChanged: Observable<number>;
        onOutputInjectionAdd: Observable<IInjectionAddEvent>;
        onOutputInjectionRemove: Observable<IInjectionRemoveEvent>;
    } {
        if (this._dependencies.stream === undefined) {
            throw new Error(this._logger.error(`stream dependency isn't inited`));
        }
        return {
            onSourceChanged: this._dependencies.stream.getObservable().onSourceChanged,
            onOutputInjectionAdd: this._subjects.onOutputInjectionAdd.asObservable(),
            onOutputInjectionRemove: this._subjects.onOutputInjectionRemove.asObservable(),
        };
    }

    public getGuid(): string {
        return this._sessionId;
    }

    public getImportable(): Importable<any>[] {
        return [
            this.getSessionComments(),
            this.getTimestamp(),
            this.getBookmarks(),
            this.getSessionSearch().getFiltersAPI(),
            this.getSessionSearch().getChartsAPI(),
            this.getSessionSearch().getRangesAPI(),
            this.getSessionSearch().getDisabledAPI(),
        ];
    }

    public getAPI(): IAPI {
        return this._api;
    }

    public getRowAPI(): ControllerRowAPI {
        if (this._dependencies.rowapi === undefined) {
            throw new Error(this._logger.error(`rowapi dependency isn't inited`));
        }
        return this._dependencies.rowapi;
    }

    public getTimestamp(): ControllerSessionTabTimestamp {
        if (this._dependencies.timestamp === undefined) {
            throw new Error(this._logger.error(`timestamp dependency isn't inited`));
        }
        return this._dependencies.timestamp;
    }

    public getStreamOutput(): ControllerSessionTabStreamOutput {
        if (this._dependencies.output === undefined) {
            throw new Error(this._logger.error(`output dependency isn't inited`));
        }
        return this._dependencies.output;
    }

    public getBookmarks(): ControllerSessionTabStreamBookmarks {
        if (this._dependencies.bookmarks === undefined) {
            throw new Error(this._logger.error(`bookmarks dependency isn't inited`));
        }
        return this._dependencies.bookmarks;
    }

    public getScope(): ControllerSessionScope {
        if (this._dependencies.scope === undefined) {
            throw new Error(this._logger.error(`scope dependency isn't inited`));
        }
        return this._dependencies.scope;
    }

    public getSessionStream(): ControllerSessionTabStream {
        if (this._dependencies.stream === undefined) {
            throw new Error(this._logger.error(`stream dependency isn't inited`));
        }
        return this._dependencies.stream;
    }

    public getSessionComments(): ControllerSessionTabStreamComments {
        if (this._dependencies.comments === undefined) {
            throw new Error(this._logger.error(`comments dependency isn't inited`));
        }
        return this._dependencies.comments;
    }

    public getSessionSearch(): ControllerSessionTabSearch {
        if (this._dependencies.search === undefined) {
            throw new Error(this._logger.error(`search dependency isn't inited`));
        }
        return this._dependencies.search;
    }

    public getSessionsStates(): ControllerSessionTabStates {
        if (this._dependencies.states === undefined) {
            throw new Error(this._logger.error(`states dependency isn't inited`));
        }
        return this._dependencies.states;
    }

    public getStreamMap(): ControllerSessionTabMap {
        if (this._dependencies.map === undefined) {
            throw new Error(this._logger.error(`map dependency isn't inited`));
        }
        return this._dependencies.map;
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

    public getTabTitleContextMenuService(): ControllerSessionTabTitleContextMenu | undefined {
        return this._titleContextMenu;
    }

    public addOutputInjection(
        injection: Toolkit.IComponentInjection,
        type: Toolkit.EViewsTypes,
        silence: boolean = false,
    ) {
        this._subjects.onOutputInjectionAdd.next({
            injection: injection,
            type: type,
            silence: silence,
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
            ServiceElectronIpc.request<IPC.StreamResetResponse>(
                new IPC.StreamResetRequest({
                    guid: this._sessionId,
                }),
                IPC.StreamResetResponse,
            )
                .then((response) => {
                    if (response.error !== undefined) {
                        this._logger.error(`StreamResetResponse returns an error: ${response.error}`);
                    }
                    this.getBookmarks().reset();
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

    public getSessionEventsHub(): Toolkit.ControllerSessionsEvents {
        return this._sessionsEventsHub;
    }

    private _onOpenSearchFiltersTab() {
        LayoutStateService.sidebarMax();
    }
}
