import { TabsService, TabsOptions, ETabsListDirection, DockingComponent, DockDef, DocksService } from 'logviewer-client-complex';
import ServiceElectronIpc from './service.electron.ipc';
import { IPCMessages, Subscription } from './service.electron.ipc';
import { ControllerSession } from '../controller/controller.session';
import * as Tools from '../tools/index';
import { IService } from '../interfaces/interface.service';

import { ViewOutputComponent } from '../components/views/output/component';

type TSessionGuid = string;

export class SessionsService implements IService {

    private _logger: Tools.Logger = new Tools.Logger('SessionsService');
    private _sessions: Map<TSessionGuid, ControllerSession> = new Map();
    private _tabsService: TabsService = new TabsService();
    private _subscriptions: { [key: string]: Subscription | undefined } = {
    };

    constructor() {

    }

    public init(): Promise<void> {
        return new Promise((resolve, reject) => {
            resolve();
        });
    }

    public getName(): string {
        return 'SessionsService';
    }

    public destroy() {
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].destroy();
        });
    }

    public create(): void {
        const guid: string = Tools.guid();
        const session = new ControllerSession({
            guid: guid,
            transports: ['terminal'],
        });
        this._tabsService.add({
            guid: guid,
            name: 'Default',
            active: false,
            content: {
                factory: DockingComponent,
                inputs: {
                    service: new DocksService(guid, new DockDef.Container({
                        a: new DockDef.Dock({ caption: 'Default', component: {
                            factory: ViewOutputComponent,
                            inputs: {
                                session: session
                            }
                        } })
                    }))
                }
            }
        });
        this._sessions.set(guid, session);
        this._tabsService.setActive(guid);
    }

    public getTabsService(): TabsService {
        return this._tabsService;
    }

}

export default (new SessionsService());


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
