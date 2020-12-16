import HotkeysService from '../../services/service.hotkeys';
import LayoutStateService from '../../services/standalone/service.layout.state';

import PluginsService, { IPluginData } from '../../services/service.plugins';
import ServiceElectronIpc, {
    IPCMessages,
    Subscription as IPCSubscription,
} from '../../services/service.electron.ipc';

import { ITabAPI } from 'chipmunk-client-material';
import { IAPI } from 'chipmunk.client.toolkit';
import { Subscription, Observable, Subject } from 'rxjs';
import { ControllerSessionTabStream, IStreamState } from './dependencies/stream/controller.session.tab.stream';
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
    private _sourceInfo: IPCMessages.IStreamSourceNew | undefined;
    private _openSourceOptions: any;
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
        this._subscriptions.onOpenSearchFiltersTab = HotkeysService.getObservable().openSearchFiltersTab.subscribe(
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
            this._dependencies.rowapi = factory<ControllerRowAPI>(
                this,
                ControllerRowAPI,
            );
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
                    Promise.all(Object.keys(this._dependencies).map((key: string) => {
                        const dep = this._dependencies[key];
                        return dep.destroy().catch((err: Error) => {
                            this._logger.warn(`Fail correctly destroy dependency "${dep.getName()}" due error: ${err.message}`);
                        });
                    })).then(() => {
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
            this._dependencies.comments,
            this._dependencies.timestamp,
            this._dependencies.bookmarks,
            this._dependencies.search.getFiltersAPI(),
            this._dependencies.search.getChartsAPI(),
            this._dependencies.search.getRangesAPI(),
            this._dependencies.search.getDisabledAPI(),
        ];
    }

    public getAPI(): IAPI {
        return this._api;
    }

    public getRowAPI(): ControllerRowAPI {
        return this._dependencies.rowapi;
    }

    public getTimestamp(): ControllerSessionTabTimestamp {
        return this._dependencies.timestamp;
    }

    public getStreamOutput(): ControllerSessionTabStreamOutput {
        return this._dependencies.output;
    }

    public getBookmarks(): ControllerSessionTabStreamBookmarks {
        return this._dependencies.bookmarks;
    }

    public getScope(): ControllerSessionScope {
        return this._dependencies.scope;
    }

    public getSessionStream(): ControllerSessionTabStream {
        return this._dependencies.stream;
    }

    public getSessionComments(): ControllerSessionTabStreamComments {
        return this._dependencies.comments;
    }

    public getSessionSearch(): ControllerSessionTabSearch {
        return this._dependencies.search;
    }

    public getSessionsStates(): ControllerSessionTabStates {
        return this._dependencies.states;
    }

    public getStreamMap(): ControllerSessionTabMap {
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
                    this._dependencies.bookmarks.reset();
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
