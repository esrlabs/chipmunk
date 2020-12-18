import * as Objects from '../tools/env.objects';
import * as FS from '../tools/fs';

import Logger from '../tools/env.logger';
import ServicePaths from '../services/service.paths';

import { PromisesSuccessiveQueue } from '../tools/promise.queue.successive';
import { IService } from '../interfaces/interface.service';

/**
 * TODO:
 * Method _validation looks like dangerous. It might be we have some new field
 * in this case state will have new field, default-state - no; validation method
 * will return Error. But should not.
 */
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
    private _allowResetToDefault: boolean = true;
    private _available: boolean = true;
    private readonly _tasks: PromisesSuccessiveQueue;

    constructor(alias: string, defaults: TState, file: string, allowResetToDefault: boolean = true) {
        this._alias = alias;
        this._logger = new Logger(alias);
        this._defaults = defaults;
        this._file = file;
        this._allowResetToDefault = allowResetToDefault;
        this._tasks = new PromisesSuccessiveQueue(`Write file queue of ${alias}`);
        this._logger.verbose(`Created state file: ${this._file}`);
    }

    /**
     * Initialization function
     * @returns Promise<void>
     */
    public init(): Promise<void> {
        return new Promise((resolve, reject) => {
            this._file = ServicePaths.resoveHomeFolder(this._file);
            this._default().then(() => {
                this._read().then((state: TState) => {
                    this._state = state;
                    this._logger.verbose(`Inited state file: ${this._file}`);
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
            this._available = false;
            this._tasks.destroy().catch((err: Error) => {
                this._logger.warn(`Fail to normally destroy a queue with: ${err.message}`);
            }).finally(resolve);
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

    public set(state: any): Promise<void> {
        return new Promise((resolve, reject) => {
            if (!this._available) {
                return reject(new Error(`Fail to write into file, because it's blocked.`));
            }
            this._state = Objects.merge(state, this._state);
            this._write().then(() => {
                resolve();
            }).catch((error: Error) => {
                reject(new Error(`Fail to write state due error: ${error.message}`));
            });
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
                    if (!this._allowResetToDefault) {
                        return reject(new Error(`Fail to get JSON from content of "${this._file}" due error: ${state.message}`));
                    } else {
                        this._logger.warn(`Cannot parse state file "${this._file}" due error: ${state.message}. Content: "${content}". File would be dropped to defaults values.`);
                        return this._default(true).then(() => {
                            resolve(this._defaults);
                        }).catch(reject);
                    }
                }
                resolve(this._validate(state));
            }).catch((error: Error) => {
                reject(this._logger.error(`Fail to read state at "${this._file}" due error: ${error.message}`));
            });
        });
    }

    private _write(): Promise<void> {
        return new Promise((resolve, reject) => {
            if (this._state === null) {
                return resolve();
            }
            const content = JSON.stringify(this._validate(this._state));
            this._tasks.add(() => {
                return FS.writeTextFile(this._file, content, true).then(() => {
                    resolve();
                }).catch((error: Error) => {
                    this._logger.error(`Fail to write state to "${this._file}" due error: ${error.message}`);
                    reject(error);
                });
            });
        });
    }

    private _validate(state: TState): TState {
        // Checking by pattern
        Object.keys(this._defaults).forEach((prop: string) => {
            if (typeof (this._defaults as any)[prop] !== typeof (state as any)[prop]) {
                // Dismatch
                if ((state as any)[prop] === undefined) {
                    // We have new field, which wasn't saved yet in file
                    (state as any)[prop] = (this._defaults as any)[prop];
                } else if ((this._defaults as any)[prop] !== undefined) {
                    // We have dismatch of format -> reset problematic field only
                    (state as any)[prop] = (this._defaults as any)[prop];
                } else if ((this._defaults as any)[prop] === undefined) {
                    this._logger.warn(`Field "${prop}" is undefined as default. This is not okay.`);
                }
            }
        });
        return state;
    }

    /**
     * Creates logviewer folder (if it's needed)
     * @returns Promise<void>
     */
    private _default(force: boolean = false): Promise<void> {
        return new Promise((resolve, reject) => {
            if (FS.isExist(this._file) && !force) {
                return resolve();
            }
            const content = JSON.stringify(this._validate(this._defaults));
            this._tasks.add(() => {
                return FS.writeTextFile(this._file, content).then(() => {
                    resolve();
                }).catch((error: Error) => {
                    this._logger.error(`Fail to write default state to "${this._file}" due error: ${error.message}`);
                    reject(error);
                });
            });
        });
    }

}
