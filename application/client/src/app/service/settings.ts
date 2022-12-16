import { SetupService, Interface, Implementation, register } from '@platform/entity/service';
import { services } from '@register/services';
import { ISettingsEntry } from '@platform/types/settings/entry';

import * as Requests from '@platform/ipc/request/index';

@SetupService(services['settings'])
export class Service extends Implementation {
    public get(): Promise<ISettingsEntry[]> {
        return new Promise((resolve, reject) => {
            Requests.IpcRequest.send(
                Requests.Settings.Entries.Response,
                new Requests.Settings.Entries.Request(),
            )
                .then((response: Requests.Settings.Entries.Response) => {
                    resolve(response.entries);
                })
                .catch(reject);
        });
    }

    public validate(path: string, key: string, value: any): Promise<string | undefined> {
        return new Promise((resolve, reject) => {
            Requests.IpcRequest.send(
                Requests.Settings.Validate.Response,
                new Requests.Settings.Validate.Request({
                    path,
                    key,
                    value,
                }),
            )
                .then((response: Requests.Settings.Validate.Response) => {
                    resolve(response.error);
                })
                .catch(reject);
        });
    }

    public set(path: string, key: string, value: any): Promise<void> {
        return new Promise((resolve, reject) => {
            Requests.IpcRequest.send(
                Requests.Settings.Set.Response,
                new Requests.Settings.Set.Request({
                    path,
                    key,
                    value,
                }),
            )
                .then((response: Requests.Settings.Validate.Response) => {
                    if (response.error !== undefined) {
                        reject(new Error(response.error));
                    } else {
                        resolve();
                    }
                })
                .catch(reject);
        });
    }
}
export interface Service extends Interface {}
export const settings = register(new Service());
