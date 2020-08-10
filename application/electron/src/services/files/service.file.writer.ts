import Logger from '../../tools/env.logger';
import * as Tools from '../../tools/index';
import * as fs from 'fs';
import { IService } from '../../interfaces/interface.service';

type TFilename = string;
type TContent = string;
type TDestroyResolver = () => void;
/**
 * @class ServiceFileWriter
 * @description Writes data into files
 */

class ServiceFileWriter implements IService {

    private _logger: Logger = new Logger('ServiceFileWriter');
    private _pending: Map<TFilename, TContent[]> = new Map();
    private _destroy: TDestroyResolver | undefined;
    private _writting: Map<TFilename, Promise<void>> = new Map();

    /**
     * Initialization function
     * @returns Promise<void>
     */
    public init(): Promise<void> {
        return new Promise((resolve, reject) => {
            resolve();
        });
    }

    public destroy(): Promise<void> {
        return new Promise((resolve) => {
            this._destroy = resolve;
            this._tryToDestroy();
        });
    }

    public getName(): string {
        return 'ServiceFileWriter';
    }

    public write(filename: string, content: string): Error | undefined {
        if (this._destroy !== undefined) {
            return new Error(this._logger.warn(`Data wouldn't be written into "${filename}" because write service would be destroyed.`));
        }
        if (typeof filename !== 'string' || filename.trim() === '') {
            return new Error(this._logger.warn(`Not valid file name`));
        }
        let pending: TContent[] | undefined = this._pending.get(filename);
        const next: boolean = pending === undefined;
        if (pending === undefined) {
            pending = [];
        }
        pending.push(content);
        this._pending.set(filename, pending);
        if (next) {
            this._next();
        }
    }

    private _next() {
        this._pending.forEach((_: TContent[], filename: TFilename) => {
            if (this._writting.has(filename)) {
                return;
            }
            const current: TContent = _[0];
            this._writting.set(filename, this._write(filename, current).catch((err: Error) => {
                this._logger.error(`Fail write data into "${filename}" due error: ${err.message}`);
            }).finally(() => {
                this._writting.delete(filename);
                const pendings: TContent[] | undefined = this._pending.get(filename);
                if (pendings === undefined) {
                    return;
                }
                pendings.splice(0, 1);
                if (pendings.length === 0) {
                    this._pending.delete(filename);
                    this._tryToDestroy();
                } else {
                    this._pending.set(filename, pendings);
                    this._next();
                }
            }));
        });
    }

    private _write(filename: string, content: string): Promise<void> {
        return new Promise((resolve, reject) => {
            fs.writeFile(filename, content, (error: NodeJS.ErrnoException | null) => {
                if (error) {
                    reject(error);
                } else {
                    resolve();
                }
            });
        });
    }

    private _tryToDestroy() {
        if (this._destroy === undefined) {
            return;
        }
        if (this._pending.size !== 0) {
            return;
        }
        this._destroy();
    }
}

export default (new ServiceFileWriter());
