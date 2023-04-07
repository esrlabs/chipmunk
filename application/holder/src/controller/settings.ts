import { scope } from 'platform/env/scope';
import { Logger } from '@env/logs/index';
import { paths } from '@service/paths';
import { AsyncLockToken } from 'platform/env/lock.token';
import { utils } from 'platform/log';
import { system } from 'platform/modules/system';

import * as obj from 'platform/env/obj';
import * as fs from 'fs';
import * as path from 'path';

export class Register {
    private _settings: Set<SettingsHolder<unknown>> = new Set();

    public add(holder: SettingsHolder<unknown>): void {
        this._settings.add(holder);
    }

    public destroy(): Promise<void> {
        return new Promise((resolve) => {
            Promise.all(Array.from(this._settings.values()).map((s) => s.write()))
                .catch((err: Error) => {
                    new Logger('SettingsRegister').error(`Fail to write settings: ${err.message}`);
                })
                .finally(resolve);
        });
    }
}

export const register = new Register();

export function settingsFactory<T>(impl: Implementation<T>): SettingsHolder<T> {
    const holder = new SettingsHolder<T>(impl);
    register.add(holder);
    return holder;
}

export abstract class Implementation<T> {
    private _logger: Logger;

    constructor() {
        this._logger = scope.getLogger(`settings: ${this.getAlias()}`) as Logger;
    }

    abstract fromString(content: string): Promise<void>;
    abstract asString(): string;
    abstract get(): T;
    abstract set(settings: T): void;
    abstract getAlias(): string;

    public setFrom(src: unknown): void {
        const settings = obj.asAnyObj(this.get());
        const source = obj.asAnyObj(src);
        Object.keys(settings).forEach((key: string) => {
            if (source[key] !== undefined) {
                settings[key] = source[key];
            }
        });
        this.set(settings as unknown as T);
    }

    public log(): Logger {
        return this._logger;
    }
}

export class SettingsHolder<T> {
    static ABORT_ERR = 'ABORT_ERR';
    private _settings: Implementation<T>;
    private _filename: string;
    private _locker: AsyncLockToken = new AsyncLockToken(false);

    constructor(settings: Implementation<T>) {
        this._settings = settings;
        this._filename = path.resolve(
            paths.getSettings(),
            `${this._settings.getAlias().toLocaleLowerCase().replace(/\s/gi, '_')}.json`,
        );
        system.doOnDestroy(`Settings holder (${this._filename})`, this.write.bind(this));
    }

    public get(): T {
        return this._settings.get();
    }

    public set(settings: T): void {
        this._settings.set(settings);
        this.write();
    }

    public setFrom(scr: unknown): void {
        this._settings.setFrom(scr);
        this.write();
    }

    public async read(): Promise<void> {
        if (!fs.existsSync(this._filename)) {
            await this.write();
        }
        let parsed = false;
        try {
            const content: string = await fs.promises.readFile(this._filename, 'utf8');
            await this._settings.fromString(content);
            parsed = true;
        } catch (err) {
            this._settings
                .log()
                .warn(
                    `Fail to read settings file "${this._filename}". Error: ${utils.error(
                        err,
                    )}. Settings will be dropped.`,
                );
        }
        if (!parsed) {
            try {
                this.write();
            } catch (err) {
                this._settings
                    .log()
                    .warn(`Fail to write settings into ${this._filename}: ${utils.error(err)}.`);
                return Promise.reject(new Error(utils.error(err)));
            }
        }
        return Promise.resolve();
    }

    public async write(): Promise<void> {
        await this._locker.unlocked();
        const cancelation = new AbortController();
        this._locker.lock(() => {
            cancelation.abort();
        });
        return fs.promises
            .writeFile(this._filename, this._settings.asString(), {
                encoding: 'utf8',
                signal: cancelation.signal,
            })
            .catch((err: Error) => {
                if (utils.getErrorCode(err) !== SettingsHolder.ABORT_ERR) {
                    this._settings
                        .log()
                        .error(
                            `Fail to write settings file "${this._filename}". Error: ${err.message}`,
                        );
                }
            })
            .finally(() => {
                this._locker.unlock();
            });
    }
}
