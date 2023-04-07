import { storage } from '@service/storage';
import { error } from 'platform/log/utils';

import * as obj from 'platform/env/obj';
import * as os from 'os';
import * as fs from 'fs';

const KEYS = {
    cwd: 'cwd',
    envvars: 'envvars',
};

export class Storage {
    static KEY = 'env_settings';

    public set(): {
        cwd(path: string): Promise<void>;
        envvars(envs: { [key: string]: string }): Promise<void>;
    } {
        return {
            cwd: (path: string): Promise<void> => {
                if (path.trim() === '') {
                    return storage.entries.delete(Storage.KEY, [KEYS.cwd]);
                }
                if (!fs.existsSync(path)) {
                    path = os.homedir();
                }
                const entry = { uuid: KEYS.cwd, content: JSON.stringify({ value: path }) };
                return storage.entries.update(Storage.KEY, [entry]);
            },
            envvars: (envs: { [key: string]: string }): Promise<void> => {
                if (Object.keys(envs).length === 0) {
                    return storage.entries.delete(Storage.KEY, [KEYS.envvars]);
                }
                const entry = { uuid: KEYS.envvars, content: JSON.stringify({ value: envs }) };
                return storage.entries.update(Storage.KEY, [entry]);
            },
        };
    }

    public get(): {
        cwd(): Promise<string | undefined>;
        envvars(): Promise<{ [key: string]: string } | undefined>;
    } {
        return {
            cwd: (): Promise<string | undefined> => {
                return new Promise((resolve, reject) => {
                    storage.entries
                        .get(Storage.KEY)
                        .then((entries) => {
                            const cwd = entries.get(KEYS.cwd);
                            if (cwd === undefined) {
                                return resolve(undefined);
                            }
                            try {
                                let path = obj.getAsNotEmptyString(
                                    JSON.parse(cwd.content),
                                    'value',
                                );
                                if (!fs.existsSync(path)) {
                                    path = os.homedir();
                                }
                                resolve(path);
                            } catch (e) {
                                reject(new Error(error(e)));
                            }
                        })
                        .catch(reject);
                });
            },
            envvars: (): Promise<{ [key: string]: string } | undefined> => {
                return new Promise((resolve, reject) => {
                    storage.entries
                        .get(Storage.KEY)
                        .then((entries) => {
                            const envvars = entries.get(KEYS.envvars);
                            if (envvars === undefined) {
                                return resolve(undefined);
                            }
                            try {
                                resolve(obj.getAsObj(JSON.parse(envvars.content), 'value'));
                            } catch (e) {
                                reject(new Error(error(e)));
                            }
                        })
                        .catch(reject);
                });
            },
        };
    }
}
