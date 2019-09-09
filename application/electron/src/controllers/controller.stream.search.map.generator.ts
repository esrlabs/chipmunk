import Logger from '../tools/env.logger';
import * as fs from 'fs';
import Transform, { IMapItem, IFoundEvent } from './controller.stream.search.pipe.transform';
import NullWritableStream from '../classes/stream.writable.null';
import { CancelablePromise } from '../tools/promise.cancelable';
import { EventEmitter } from 'events';

export { IFoundEvent };

type TMeasurer = () => void;

export default class ControllerStreamSearchMapGenerator extends EventEmitter {

    public static Events = {
        found: 'found',
    };

    private _guid: string;
    private _logger: Logger;
    private _file: string;
    private _reader: fs.ReadStream | undefined;
    private _writer: NullWritableStream | undefined;
    private _transform: Transform | undefined;
    private _measurer: TMeasurer | undefined;
    private _promise: CancelablePromise<IMapItem[], void> | undefined;

    constructor(guid: string, file: string) {
        super();
        this._guid = guid;
        this._file = file;
        this._logger = new Logger(`ControllerStreamSearchMapGenerator: ${this._guid}`);
    }

    public destroy(): Promise<void> {
        return new Promise((resolve, reject) => {
            this.removeAllListeners();
            resolve();
        });
    }

    public generate(bytes: number, rows: number): CancelablePromise<IMapItem[], void> | Error {
        if (this._promise !== undefined) {
            const msg: string = `(generate) Fail to start reading, because previous process isn't finished.`;
            this._logger.warn(msg);
            return new Error(msg);
        }
        this._promise = this._read(bytes, rows, false);
        this._promise.cancel(this._clear.bind(this));
        this._promise.finally(this._clear.bind(this));
        return this._promise;
    }

    public append(bytes: number, rows: number): CancelablePromise<IMapItem[], void> | Error {
        if (this._promise !== undefined) {
            const msg: string = `(append) Fail to start reading, because previous process isn't finished.`;
            this._logger.warn(msg);
            return new Error(msg);
        }
        this._promise = this._read(bytes, rows, true);
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

    private _read(bytes: number, rows: number, append: boolean): CancelablePromise<IMapItem[], void> {
        return new CancelablePromise((resolve, reject, cancel, self) => {
            this._setMeasurer();
            const options = append ? { start: bytes } : {};
            // Create reader
            this._reader = fs.createReadStream(this._file, options);
            // Create writer
            this._writer = new NullWritableStream();
            // Create transformer
            this._transform = new Transform({}, this._guid, { bytes: bytes, rows: rows });
            // Add listeners
            this._transform.on(Transform.Events.found, (event: IFoundEvent) => {
                this.emit(ControllerStreamSearchMapGenerator.Events.found, event);
            });
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
                if (this._transform.getMap().length === 0) {
                    this._logger.warn(`Transformer doesn't have any item of map`);
                }
                resolve(this._transform.getMap());
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
        this._measurer = undefined;
        this._promise = undefined;
        this._transform = undefined;
    }

    private _setMeasurer() {
        this._measurer = this._logger.measure(`mapping`);
    }

}
