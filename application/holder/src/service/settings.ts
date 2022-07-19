import {
    SetupService,
    Interface,
    Implementation,
    register,
    DependOn,
} from 'platform/entity/service';
import { Storage } from 'platform/types/storage/storage';
import { Entry } from 'platform/types/settings/entry';
import { services } from '@register/services';
import { storage } from '@service/storage';
import { paths } from '@service/paths';
import { FileController } from '@env/fs/accessor';

import * as initial from './settings/index';
import * as path from 'path';

const SETTINGS_FILE = 'settings.json';

@DependOn(paths)
@DependOn(storage)
@SetupService(services['settings'])
export class Service extends Implementation {
    protected storage!: Storage;
    protected entries: Map<string, Entry<string | boolean | number | undefined>> = new Map();

    public override ready(): Promise<void> {
        return this.storage.load();
    }

    public override init(): Promise<void> {
        this.storage = new Storage(
            new FileController(path.resolve(paths.getHome(), SETTINGS_FILE)).init(),
            {},
        );
        return new Promise((resolve, reject) => {
            this.storage
                .load()
                .then(() => {
                    this.enroll(initial.network.settings.proxy);
                    this.enroll(initial.network.settings.authorization);
                    this.enroll(initial.network.settings.strictSSL);
                    this.enroll(initial.updater.settings.autoUpdateCheck);
                    resolve();
                })
                .catch(reject);
        });
    }

    public override destroy(): Promise<void> {
        return this.storage.destroy();
    }

    public enroll(entry: Entry<string | boolean | number | undefined>): Error | undefined {
        if (this.entries.has(entry.value.fullpath())) {
            return new Error(`Entry "${entry.value.fullpath()}" already has been registred`);
        }
        entry.bind(this.storage);
        this.entries.set(entry.value.fullpath(), entry);
        return undefined;
    }

    public get<T extends string | number | boolean>(path: string, key: string): T | undefined {
        return this.storage.get<T>(path, key);
    }
}
export interface Service extends Interface {}
export const settings = register(new Service());
