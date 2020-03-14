import { IService } from '../interfaces/interface.service';
import { Observable, Subject, Subscription } from 'rxjs';
import ElectronIpcService, { IPCMessages } from './service.electron.ipc';
import TabsSessionsService from './service.sessions.tabs';
import { TabAboutComponent } from '../components/tabs/about/component';
import * as Toolkit from 'chipmunk.client.toolkit';

export class TabsCustomService implements IService {

    private _logger: Toolkit.Logger = new Toolkit.Logger('TabsCustomService');
    private _subscriptions: { [key: string]: Subscription | Toolkit.Subscription | undefined } = { };

    constructor() {
    }

    public init(): Promise<void> {
        return new Promise((resolve, reject) => {
            resolve();
            setTimeout(() => {
                TabsSessionsService.add({
                    id: 'about',
                    title: 'About',
                    component: {
                        factory: TabAboutComponent,
                        inputs: {}
                    }
                });
            }, 5000);
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

}

export default (new TabsCustomService());
