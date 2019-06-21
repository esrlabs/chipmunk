import { TabsService, DockingComponent, DockDef, DocksService, ITab } from 'logviewer-client-complex';
import { Subscription } from './service.electron.ipc';
import { ControllerSessionTab, ISidebarTabOptions } from '../controller/controller.session.tab';
import * as Toolkit from 'logviewer.client.toolkit';
import { IService } from '../interfaces/interface.service';
import { Observable, Subject, Subscription as SubscriptionRX } from 'rxjs';
import { IDefaultView, IDefaultSideBarApp } from '../states/state.default';
import ElectronIpcService, { IPCMessages } from './service.electron.ipc';
export { ControllerSessionTabSearch, IRequest } from '../controller/controller.session.tab.search';

export type TSessionGuid = string;

export class TabsSessionsService implements IService {

    private _logger: Toolkit.Logger = new Toolkit.Logger('TabsSessionsService');
    private _sessions: Map<TSessionGuid, ControllerSessionTab> = new Map();
    private _tabsService: TabsService = new TabsService();
    private _subscriptions: { [key: string]: Subscription | SubscriptionRX | undefined } = { };
    private _currentSessionGuid: string;
    private _defaults: {
        views: IDefaultView[],
        sidebarApps: IDefaultSideBarApp[],
    } = {
        views: [],
        sidebarApps: [],
    };
    private _subjects: {
        onSessionChange: Subject<ControllerSessionTab>
    } = {
        onSessionChange: new Subject<ControllerSessionTab>()
    };

    public init(): Promise<void> {
        return new Promise((resolve, reject) => {
            this._subscriptions.onSessionTabChanged = this._tabsService.getObservable().active.subscribe(this._onSessionTabSwitched.bind(this));
            this._subscriptions.onSessionTabClosed = this._tabsService.getObservable().removed.subscribe(this._onSessionTabClosed.bind(this));

            resolve();
        });
    }

    public getName(): string {
        return 'TabsSessionsService';
    }

    public destroy() {
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
        });
    }

    public setDefaultViews(views: IDefaultView[]) {
        this._defaults.views = views;
    }

    public setDefaultSidebarApps(apps: IDefaultSideBarApp[]) {
        this._defaults.sidebarApps = apps;
    }

    public add(): void {
        const guid: string = Toolkit.guid();
        const session = new ControllerSessionTab({
            guid: guid,
            transports: ['processes', 'dlt'],
            defaultsSideBarApps: this._defaults.sidebarApps
        });
        this._tabsService.add({
            guid: guid,
            name: 'Default',
            active: true,
            content: {
                factory: DockingComponent,
                inputs: {
                    service: new DocksService(guid, new DockDef.Container({
                        a: new DockDef.Dock({ caption: this._defaults.views[0].name, component: {
                            factory: this._defaults.views[0].component,
                            inputs: {
                                session: session,
                            }
                        } })
                    }))
                }
            }
        });
        this._sessions.set(guid, session);
        this.setActive(guid);
    }

    public addSidebarApp(name: string, component: any, inputs: { [key: string]: any }, session?: string, options?: ISidebarTabOptions): string | Error {
        if (session === undefined) {
            session = this._currentSessionGuid;
        }
        // Get session controller
        const controller: ControllerSessionTab = this._sessions.get(session);
        if (controller === undefined) {
            return new Error(`Fail to find defiend session "${session}"`);
        }
        return controller.addSidebarApp(name, component, inputs, options);
    }

    public openSidebarTab(guid: string, session?: string): Error | undefined {
        if (session === undefined) {
            session = this._currentSessionGuid;
        }
        // Get session controller
        const controller: ControllerSessionTab = this._sessions.get(session);
        if (controller === undefined) {
            return new Error(`Fail to find defiend session "${session}"`);
        }
        controller.openSidebarTab(guid);
    }

    public removeSidebarApp(guid: string, session?: string): Error | undefined {
        if (session === undefined) {
            session = this._currentSessionGuid;
        }
        // Get session controller
        const controller: ControllerSessionTab = this._sessions.get(session);
        if (controller === undefined) {
            return new Error(`Fail to find defiend session "${session}"`);
        }
        controller.removeSidebarApp(guid);
    }

    public getTabsService(): TabsService {
        return this._tabsService;
    }

    public getSessionController(session: string): ControllerSessionTab | Error {
        if (session === undefined) {
            session = this._currentSessionGuid;
        }
        const controller: ControllerSessionTab = this._sessions.get(session);
        if (controller === undefined) {
            return new Error(`Fail to find defiend session "${session}"`);
        }
        return controller;
    }

    public getObservable(): {
        onSessionChange: Observable<ControllerSessionTab>
    } {
        return {
            onSessionChange: this._subjects.onSessionChange.asObservable()
        };
    }

    public setActive(guid: string) {
        const session: ControllerSessionTab | undefined = this._sessions.get(guid);
        if (session === undefined) {
            return this._logger.warn(`Cannot fild session ${guid}. Cannot make this session active.`);
        }
        this._currentSessionGuid = guid;
        this._tabsService.setActive(this._currentSessionGuid);
        ElectronIpcService.send(new IPCMessages.StreamSetActive({ guid: this._currentSessionGuid })).then(() => {
            this._subjects.onSessionChange.next(session);
        }).catch((error: Error) => {
            this._logger.warn(`Fail to send notification about active session due error: ${error.message}`);
        });
    }

    public getActive(): ControllerSessionTab | undefined {
        return this._sessions.get(this._currentSessionGuid);
    }

    private _onSessionTabSwitched(tab: ITab) {
        if (this._currentSessionGuid === tab.guid) {
            return;
        }
        this.setActive(tab.guid);
    }

    private _onSessionTabClosed(session: string) {
        // Get session controller
        const controller: ControllerSessionTab = this._sessions.get(session);
        if (controller === undefined) {
            return this._logger.warn(`Fail to destroy session "${session}" because cannot find this session.`);
        }
        controller.destroy().then(() => {
            this._logger.env(`Session "${session}" is destroyed`);
        }).catch((error: Error) => {
            this._logger.warn(`Fail to destroy session "${session}" due error: ${error.message}`);
        });
    }

}

export default (new TabsSessionsService());


        /*
        this.tabsService.add({
            name: 'Tab 2 (2)',
            active: false,
            content: {
                factory: DockingComponent,
                inputs: {
                    service: new DocksService('1', new DockDef.Container({
                        a: new DockDef.Dock({ caption: 'Dock 1' }),
                        b: new DockDef.Dock({ caption: 'Dock 2' })
                    }))
                }
            }
        });
        this.tabsService.add({
            name: 'Tab 3 (4)',
            active: false,
            content: {
                factory: DockingComponent,
                inputs: {
                    service: new DocksService('1', new DockDef.Container({
                        a: new DockDef.Container({
                            a: new DockDef.Dock({ caption: '1' }),
                            b: new DockDef.Dock({ caption: '2' })
                        }),
                        b: new DockDef.Container({
                            a: new DockDef.Dock({ caption: '3' }),
                            b: new DockDef.Dock({ caption: '4' })
                        })
                    }))
                }
            }
        });
        this.tabsService.add({
            name: 'Tab 4 (5)',
            active: false,
            content: {
                factory: DockingComponent,
                inputs: {
                    service: new DocksService('1', new DockDef.Container({
                        a: new DockDef.Container({
                            a: new DockDef.Dock({ caption: 'Dock 1' }),
                            b: new DockDef.Dock({ caption: 'Dock 2' })
                        }),
                        b: new DockDef.Container({
                            a: new DockDef.Dock({ caption: 'Dock 3' }),
                            b: new DockDef.Container({
                                a: new DockDef.Dock({ caption: 'Dock 4' }),
                                b: new DockDef.Dock({ caption: 'Dock 5' })
                            })
                        })
                    }))
                }
            }
        });
        this.tabsService.add({
            name: 'Tab 5',
            active: false,
            content: {
                factory: DockingComponent,
                inputs: {
                    service: new DocksService('1', new DockDef.Container({
                        a: new DockDef.Dock({ caption: 'Dock 1' })
                    }))
                }
            }
        });
        */
