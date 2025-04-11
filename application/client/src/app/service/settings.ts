import { SetupService, Interface, Implementation, register } from '@platform/entity/service';
import { services } from '@register/services';
import { ISettingsEntry } from '@platform/types/settings/entry';
import { IDescription } from '@platform/types/settings/entry.description';
import { styles } from '@ui/service/styles';

import * as Requests from '@platform/ipc/request/index';

export interface ILocalDefaults {
    'general.colors.match': string;
    'general.colors.default_filter': string;
    'general.colors.default_chart': string;
}
export const DEFAULTS: ILocalDefaults = {
    'general.colors.match': styles.colors().scheme_color_2,
    'general.colors.default_filter': styles.colors().scheme_color_match,
    'general.colors.default_chart': styles.colors().scheme_color_match,
};

@SetupService(services['settings'])
export class Service extends Implementation {
    protected updateLocalSettings(): Promise<void> {
        return Promise.all(
            Object.keys(DEFAULTS).map((k) => {
                const parts = k.split('.');
                let path = '';
                let key = '';
                if (parts.length === 1) {
                    key = k;
                } else {
                    path = parts.splice(0, parts.length - 1).join('.');
                    key = parts[0];
                }
                return this.getByPath(path, key)
                    .then((value) => {
                        (this.defaults as any)[k] =
                            value === undefined ? (DEFAULTS as any)[k] : value;
                    })
                    .catch((err: Error) => {
                        this.log().error(`Fail to get settings for "${k}": ${err.message}`);
                    });
            }),
        )
            .then(() => undefined)
            .catch((err: Error) => {
                this.log().error(`Fail to update defaults local setting: ${err.message}`);
            });
    }

    public defaults: ILocalDefaults = Object.assign({}, DEFAULTS);

    public override ready(): Promise<void> {
        return this.updateLocalSettings().catch((err: Error) => {
            this.log().error(`Updating local defaults settings: ${err.message}`);
        });
    }

    public getDefaultByDesc(desc: IDescription): unknown {
        return (DEFAULTS as { [key: string]: any })[
            desc.path !== '' ? `${desc.path}.${desc.key}` : desc.key
        ];
    }

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

    public getByPath(path: string, key: string): Promise<string | undefined | number | boolean> {
        return new Promise((resolve, reject) => {
            Requests.IpcRequest.send(
                Requests.Settings.Get.Response,
                new Requests.Settings.Get.Request({
                    path,
                    key,
                }),
            )
                .then((response: Requests.Settings.Get.Response) => {
                    resolve(response.value);
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
                    this.updateLocalSettings();
                })
                .catch(reject);
        });
    }
}
export interface Service extends Interface {}
export const settings = register(new Service());
