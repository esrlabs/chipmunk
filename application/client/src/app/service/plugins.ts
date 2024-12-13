import { SetupService, Interface, Implementation, register } from '@platform/entity/service';
import { services } from '@register/services';

import * as Requests from '@platform/ipc/request/index';

@SetupService(services['plugins'])
export class Service extends Implementation {
    public allPlugins(): Promise<string> {
        return new Promise((resolve, reject) => {
            Requests.IpcRequest.send(
                Requests.Plugins.ListAll.Response,
                new Requests.Plugins.ListAll.Request(),
            )
                .then((response: Requests.Plugins.ListAll.Response) => {
                    resolve(response.pluginsJson);
                })
                .catch(reject);
        });
    }

    public activePlugins(): Promise<string> {
        return new Promise((reslove, reject) => {
            Requests.IpcRequest.send(
                Requests.Plugins.ListActive.Response,
                new Requests.Plugins.ListActive.Request(),
            )
                .then((response: Requests.Plugins.ListActive.Response) => {
                    reslove(response.pluginsJson);
                })
                .catch(reject);
        });
    }

    public reloadPlugins(): Promise<void> {
        return new Promise((resolve, reject) => {
            Requests.IpcRequest.send(
                Requests.Plugins.Reload.Response,
                new Requests.Plugins.Reload.Request(),
            )
                .then(() => {
                    resolve();
                })
                .catch(reject);
        });
    }
}

export interface Service extends Interface {}
export const plugins = register(new Service());
