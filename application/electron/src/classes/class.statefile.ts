import * as Objects from '../tools/env.objects';
import * as FS from '../tools/fs';

import Logger from '../tools/env.logger';
import ServicePaths from '../services/service.paths';

import { IService } from '../interfaces/interface.service';

/**
 * @class StateFile
 * @description Used as parent for state services
 */

export class StateFile<TState> implements IService {
    private _alias: string;
    private _logger: Logger;
    private _file: string;
    private _defaults: TState;
    private _state: TState | null = null;

    constructor(alias: string, defaults: TState, file: string) {
        this._alias = alias;
        this._logger = new Logger(alias);
        this._defaults = defaults;
        this._file = ServicePaths.resoveHomeFolder(file);
        this._logger.verbose(`Inited state file: ${this._file}`);
    }

    /**
     * Initialization function
     * @returns Promise<void>
     */
    public init(): Promise<void> {
        return new Promise((resolve, reject) => {
            this._default().then(() => {
                this._read().then((state: TState) => {
                    this._state = state;
                    resolve();
                }).catch((error: Error) => {
                    this._state = null;
                    this._logger.error(`Fail to read state due error: ${error.message}`);
                    reject(error);
                });
            }).catch((error: Error) => {
                this._state = null;
                this._logger.error(`Fail to write default state due error: ${error.message}`);
                reject(error);
            });
        });
    }

    public destroy(): Promise<void> {
        return new Promise((resolve) => {
            resolve();
        });
    }

    public getName(): string {
        return this._alias;
    }

    public get(): TState {
        if (this._state === null) {
            this._logger.error(`Settings arn't defined. Used default state.`);
            return Objects.copy(this._defaults);
        }
        return Objects.copy(this._state);
    }

    public set(state: any) {
        this._state = Objects.merge(state, this._state);
        this._write().catch((error: Error) => {
            this._logger.error(`Fail to write state due error: ${error.message}`);
        });
    }

    private _read(): Promise<TState> {
        return new Promise((resolve, reject) => {
            if (!FS.isExist(this._file)) {
                return reject(new Error(this._logger.error(`Settings file "${this._file}" doesn't exist`)));
            }
            FS.readTextFile(this._file).then((content: string) => {
                const state = Objects.getJSON(content);
                if (state instanceof Error) {
                    return reject(new Error(this._logger.error(`Cannot parse state file "${this._file}" due error: ${state.message}`)));
                }
                const valid: Error | void = this._validate(state);
                if (valid instanceof Error) {
                    return reject(new Error(this._logger.error(`Wrong format of state file "${this._file}": ${valid.message}`)));
                }
                resolve(state);
            }).catch((error: Error) => {
                this._logger.error(`Fail to read state at "${this._file}" due error: ${error.message}`);
            });
        });
    }

    private _write(): Promise<void> {
        return new Promise((resolve, reject) => {
            FS.writeTextFile(this._file, JSON.stringify(this._state), true).then(() => {
                resolve();
            }).catch((error: Error) => {
                this._logger.error(`Fail to write state to "${this._file}" due error: ${error.message}`);
                reject(error);
            });
        });
    }

    private _validate(state: TState): void | Error {
        const errors: Error[] = Objects.isSimular(state, this._defaults);
        if (errors.length > 0) {
            return new Error(`Settings format errors: ${errors.map((error: Error) => {
                return error.message;
            }).join('; ')}`);
        }
        return void 0;
    }

    /**
     * Creates logviewer folder (if it's needed)
     * @returns Promise<void>
     */
    private _default(): Promise<void> {
        return new Promise((resolve, reject) => {
            if (FS.isExist(this._file)) {
                return resolve();
            }
            FS.writeTextFile(this._file, JSON.stringify(this._defaults)).then(() => {
                resolve();
            }).catch((error: Error) => {
                this._logger.error(`Fail to write default state to "${this._file}" due error: ${error.message}`);
                reject(error);
            });
        });
    }

}
