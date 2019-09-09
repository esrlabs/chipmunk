import Logger from '../tools/env.logger';
import * as fs from 'fs';
import TransformMatches, { TMap, TStats } from './controller.stream.search.pipe.matches';
import NullWritableStream from '../classes/stream.writable.null';
import { CancelablePromise } from '../tools/promise.cancelable';

export interface IMapData {
    map: TMap;
    stats: TStats;
}

export { TMap, TStats };

type TMeasurer = () => void;

export default class ControllerStreamSearchMapInspector {

    private _guid: string;
    private _logger: Logger;
    private _file: string;
    private _reader: fs.ReadStream | undefined;
    private _writer: NullWritableStream | undefined;
    private _transform: TransformMatches | undefined;
    private _measurer: TMeasurer | undefined;
    private _promise: CancelablePromise<IMapData, void> | undefined;

    constructor(guid: string, file: string) {
        this._guid = guid;
        this._file = file;
        this._logger = new Logger(`ControllerStreamSearchMapInspector: ${this._guid}`);
    }

    public destroy(): Promise<void> {
        return new Promise((resolve, reject) => {
            resolve();
        });
    }

    public get(from: number = 0, regs: RegExp[]): CancelablePromise<IMapData, void> | Error {
        if (this._promise !== undefined) {
            const msg: string = `Fail to start reading, because previous process isn't finished.`;
            this._logger.warn(msg);
            return new Error(msg);
        }
        this._promise = this._read(from, regs);
        this._promise.cancel(this._clear.bind(this));
        this._promise.finally(this._clear.bind(this));
        return this._promise;
    }

    public cancel(): boolean {
        if (this._promise === undefined) {
            return false;
        }
        this._promise.break();
        return true;
    }

    private _read(from: number, regs: RegExp[]): CancelablePromise<IMapData, void> {
        return new CancelablePromise((resolve, reject) => {
            this._setMeasurer();
            const options = from > 0 ? { start: from } : {};
            // Create reader
            this._reader = fs.createReadStream(this._file, options);
            // Create writer
            this._writer = new NullWritableStream();
            // Create transformer
            this._transform = new TransformMatches({}, this._guid, regs);
            // Listen error on reading
            this._reader.once('error', (readingError: Error) => {
                reject(new Error(this._logger.error(`Fail to read file due error: ${readingError.message}`)));
            });
            // Listen error on writing
            this._reader.once('error', (readingError: Error) => {
                reject(new Error(this._logger.error(`Fail to write file due error: ${readingError.message}`)));
            });
            // Listen end of writing
            this._writer.once('finish', () => {
                if (this._transform === undefined) {
                    return reject(new Error(`Transformer was destroyed before stream is closed.`));
                }
                resolve({
                    map: this._transform.getMap(),
                    stats: this._transform.getStats(),
                });
            });
            // Execute operation
            this._reader.pipe(this._transform).pipe(this._writer);
        });
    }

    private _clear() {
        if (this._transform !== undefined) {
            this._transform.stop();
            this._transform.unpipe();
            this._transform.removeAllListeners();
            this._transform.destroy();
        }
        if (this._reader !== undefined) {
            this._reader.unpipe();
            this._reader.removeAllListeners();
            this._reader.destroy();
        }
        if (this._writer !== undefined) {
            this._writer.removeAllListeners();
            // this._writer.destroy();
        }
        if (this._measurer !== undefined) {
            this._measurer();
        }
        this._reader = undefined;
        this._writer = undefined;
        this._transform = undefined;
        this._measurer = undefined;
        this._promise = undefined;
    }

    private _setMeasurer() {
        this._measurer = this._logger.measure(`inspecting`);
    }

}
