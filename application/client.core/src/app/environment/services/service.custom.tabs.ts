import { IService } from '../interfaces/interface.service';
import { Subscription } from 'rxjs';
import { TabAboutComponent } from '../components/tabs/about/component';

import ElectronIpcService, { IPCMessages } from './service.electron.ipc';
import TabsSessionsService from './service.sessions.tabs';

import * as Toolkit from 'chipmunk.client.toolkit';

export class TabsCustomService implements IService {

    private _logger: Toolkit.Logger = new Toolkit.Logger('TabsCustomService');
    private _subscriptions: { [key: string]: Subscription | Toolkit.Subscription | undefined } = { };

    constructor() {
    }

    public init(): Promise<void> {
        return new Promise((resolve, reject) => {
            this._subscriptions.TabCustomAbout = ElectronIpcService.subscribe(IPCMessages.TabCustomAbout, this._onTabCustomAbout.bind(this));
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

}

export default (new TabsCustomService());
