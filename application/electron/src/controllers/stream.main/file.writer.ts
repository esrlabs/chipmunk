import * as fs from 'fs';
import * as Stream from 'stream';

import { EventEmitter } from 'events';

import Logger from '../../tools/env.logger';
import Transform, { ITransformResult } from './file.map.transform';
import BytesRowsMap from './file.map';

export { ITransformResult };

interface IPendingTask {
    chunk: string;
    plugingId: number;
    resolver: () => void;
    rejector: (error: Error) => void;
}

export class FileWriter extends EventEmitter {

    public static Events = {
        ChunkWritten: 'ChunkWritten',
    };

    private _file: string;
    private _stream: fs.WriteStream | undefined;
    private _logger: Logger;
    private _guid: string;
    private _blocked: boolean = false;
    private _locked: boolean = false;
    private _tasks: IPendingTask[] = [];
    private _map: BytesRowsMap;

    constructor(guid: string, file: string, map: BytesRowsMap) {
        super();
        this._guid = guid;
        this._file = file;
        this._map = map;
        this._logger = new Logger(`StreamFileWriter: ${this._guid}`);
        this.resume();
    }

    public destroy(): Promise<void> {
        return new Promise((resolve, reject) => {
            // Destroy stream
            if (this._stream !== undefined) {
                this._stream.close();
                this._stream.destroy();
                this._stream = undefined;
            }
            resolve();
        });
    }

    public write(chunk: string, pluginId: number): Promise<void> {
        return new Promise((resolve, reject) => {
            this._tasks.push({
                chunk: chunk,
                plugingId: pluginId,
                resolver: resolve,
                rejector: reject,
            });
            this._next();
        });
    }

    public stop() {
        if (this._stream !== undefined) {
            this._stream.close();
            this._stream.destroy();
            this._stream = undefined;
        }
    }

    public resume() {
        if (this._stream !== undefined) {
            return;
        }
        this._stream = fs.createWriteStream(this._file, { encoding: 'utf8', flags: 'a' });
        this._next();
    }

    private _write(chunk: string, pluginId: number): Promise<void> {
        return new Promise((resolve, reject) => {
            // Convert chunk to string
            const transform: Transform = new Transform( {},
                                                        this._guid,
                                                        pluginId,
                                                        { bytes: this._map.getByteLength(), rows: this._map.getRowsCount() });
            transform.convert(chunk, (converted: ITransformResult) => {
                if (converted.output === '') {
                    // Nothing to write
                    this._logger.debug(`Chunk is empty. Nothing to write.`);
                    return resolve();
                }
                if (this._stream === undefined) {
                    this._logger.debug(`Cannot write to stream, while it's blocked.`);
                    return resolve();
                }
                // Add data into map
                // We should update map here, because it might be next write operation is already started.
                // So cursor in map should be already moved forward.
                this._map.add(converted.map);
                // Write data into file
                this._stream.write(converted.output, (writeError: Error | null | undefined) => {
                    if (writeError) {
                        this._logger.error(`Fail to write data (pluginId "${pluginId}") into stream file due error: ${writeError.message}`);
                        return reject(writeError);
                    }
                    // Trigger event on stream was updated
                    this.emit(FileWriter.Events.ChunkWritten, converted.map);
                    // Restart pending
                    return resolve();
                });
            });
        });
    }

    private _next() {
        if (this._tasks.length === 0) {
            return;
        }
        if (this._isLocked()) {
            this._logger.debug(`Task is postponed. Tasks in queue: ${this._tasks.length}`);
            return;
        }
        if (this._stream === undefined) {
            return;
        }
        const task: IPendingTask = this._tasks[0];
        this._lock()._write(task.chunk, task.plugingId).then(() => {
            this._tasks.splice(0, 1);
            task.resolver();
            this._unlock()._next();
        }).catch((err: Error) => {
            task.rejector(err);
            this._unlock()._next();
        });
    }

    private _lock(): FileWriter {
        this._locked = true;
        return this;
    }

    private _unlock(): FileWriter {
        this._locked = false;
        return this;
    }

    private _isLocked(): boolean {
        return this._locked;
    }

}
