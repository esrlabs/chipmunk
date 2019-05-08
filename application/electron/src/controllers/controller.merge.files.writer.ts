// tslint:disable:max-classes-per-file
import * as fs from 'fs';
import * as path from 'path';
import Holder from './controller.merge.files.writer.holder';
import Queue from './controller.merge.files.writer.queue';
import ServiceStreams from '../services/service.streams';
import ServiceStreamSource from '../services/service.stream.sources';
import * as Tools from '../tools/index';
import Logger from '../tools/env.logger';

type TResolver = (written: number) => void;
type TRejector = (error: Error) => void;

export interface IFile {
    file: string;
    reg: RegExp;
    zone: string;
    format: string;
    offset: number;
    parser: string;
}

export default class MergeFilesWriter {

    private _logger: Logger = new Logger('MergeFilesWriter');
    private _files: IFile[];
    private _readers: { [key: string]: fs.ReadStream } = {};
    private _holders: { [key: string]: Holder } = {};
    private _sourceIds: { [key: string]: number } = {};
    private _complited: { [key: string]: boolean } = {};
    private _queue: Queue = new Queue();
    private _resolve: TResolver | undefined;
    private _reject: TRejector | undefined;
    private _writeSessionsId: string = Tools.guid();
    private _written: number = 0;
    private _size: number = 0;
    private _read: number = 0;

    constructor(files: IFile[]) {
        this._files = files;
        this._queue.on(Queue.Events.done, this._onAllChunksRead.bind(this));
        this._queue.on(Queue.Events.finish, this._onAllFilesRead.bind(this));
    }

    public write(): Promise<number> {
        return new Promise((resolve, reject) => {
            // Get common file size
            this._getSize().then((size: number) => {
                let error: Error | undefined;
                // Start session
                ServiceStreams.addPipeSession(this._writeSessionsId, size, this._files.map((file: IFile) => {
                    return path.basename(file.file);
                }).join('; '));
                // Store resolver and rejector
                this._resolve = resolve;
                this._reject = reject;
                // Create streams and holders
                this._files.forEach((file: IFile) => {
                    if (error !== undefined) {
                        return;
                    }
                    // Create holder
                    try {
                        this._holders[file.file] = new Holder(file.file, file.reg, file.format, file.offset, file.zone, file.parser);
                    } catch (e) {
                        error = e;
                        return;
                    }
                    // Set flags
                    this._complited[file.file] = false;
                    // Add new description of source
                    this._sourceIds[file.file] = ServiceStreamSource.add({ name: path.basename(file.file) });
                    // Create reader
                    const reader = fs.createReadStream(file.file);
                    // Attach listeners
                    reader.on('data', this._onData.bind(this, file));
                    reader.on('end', this._onEnd.bind(this, file));
                    // Store reader
                    this._readers[file.file] = reader;
                });
                if (error !== undefined) {
                    this._reject = undefined;
                    this._resolve = undefined;
                    return reject(error);
                }
                // Set queue
                this._queue.setCount(this._files.length);
            }).catch((error: Error) => {
                reject(error);
            });
        });
    }

    public destroy() {
        ServiceStreams.removePipeSession(this._writeSessionsId);
        // Destroy queue
        this._queue.destroy();
        // Close all reader and holders
        this._files.forEach((file: IFile) => {
            this._readers[file.file].destroy();
            this._holders[file.file].destroy();
        });
        // Drop all others
        this._readers = {};
        this._holders = {};
        this._sourceIds = {};
        this._complited = {};
        this._reject = undefined;
        this._resolve = undefined;
    }

    private _getSize(): Promise<number> {
        return new Promise((resolve, reject) => {
            let size: number = 0;
            Promise.all(this._files.map((file: IFile) => {
                return new Promise((resolveFile, rejectFile) => {
                    fs.stat(file.file, (error: NodeJS.ErrnoException | null, stats: fs.Stats) => {
                        if (error !== null) {
                            return rejectFile(error);
                        }
                        size += stats.size;
                        resolveFile();
                    });
                });
            })).then(() => {
                this._size = size;
                resolve(size);
            }).catch((error) => {
                reject(error);
            });
        });
    }

    private _onData(file: IFile, chunk: Buffer) {
        // Pause stream
        this._pause(file.file);
        // Update state of read
        this._read += chunk.byteLength;
        // Add data into holder
        const holder: Holder = this._getHolder(file.file);
        holder.add(chunk).then(() => {
            // Add done
            this._queue.done();
        }).catch((error: Error) => {
            this._logger.error(`Fail to proccess data due error: ${error.message}`);
        });
    }

    private _onEnd(file: IFile) {
        // Set flag
        this._complited[file.file] = true;
        // Remove from queue
        this._queue.finish();
    }

    private _pause(file: string) {
        const stream: fs.ReadStream | undefined = this._readers[file];
        if (stream === undefined) {
            return;
        }
        stream.pause();
    }

    private _resume(file?: string) {
        if (file !== undefined) {
            const stream: fs.ReadStream | undefined = this._readers[file];
            if (stream === undefined) {
                return;
            }
            stream.resume();
        } else {
            Object.keys(this._complited).forEach((fileName: string) => {
                if (this._complited[fileName]) {
                    return;
                }
                this._resume(fileName);
            });
        }
    }

    private _getHolder(file: string): Holder {
        return this._holders[file] as Holder;
    }

    private _onAllChunksRead() {
        // Before proceed we should sure: all chunks of all files have at least one valid date record
        const filesWithoutValidDate: string[] = this._getFilesWithoutValidDate();
        if (filesWithoutValidDate.length > 0) {
            // Read again
            filesWithoutValidDate.forEach((file: string) => {
                this._resume(file);
            });
            return;
        }
        const usedFiles: string[] = [];
        do {
            // Who has earliest time
            const earliest: string | undefined = this._getFileWithEarliestTime();
            if (earliest === undefined) {
                // Data from not finished files doesn't consist timestamps. Forward loading.
                this._resume();
                break;
            }
            // Get chunk of data to be written
            const holder = this._getHolder(earliest);
            const chunk: Buffer = Buffer.from(holder.getEarliestChunk());
            // Store written size
            this._written += chunk.length;
            // Write data
            ServiceStreams.writeTo(chunk, this._getSourceId(earliest)).catch(this._fail);
            // Check does file's data is finished or not
            if (holder.isFinished() && !this._isComplited(earliest)) {
                // File is finished, has to be read more
                usedFiles.push(earliest);
                break;
            }
        } while (true);
        // No more data
        if (usedFiles.length === 0) {
            // ATTENTION: if we are here -> something goes wrong
            return;
        }
        // Update quere
        this._queue.setCount(usedFiles.length);
        // Continue reading only files, which was written
        usedFiles.forEach((file: string) => {
            this._resume(file);
        });
    }

    private _onAllFilesRead() {
        // Check: is all files completed
        if (!this._isAllComplited()) {
            // Resume not complited
            return this._resume();
        }
        // Write rest of data
        Object.keys(this._holders).forEach((file: string) => {
            const holder: Holder = this._holders[file];
            const rest: string | undefined = holder.getRest();
            if (rest === undefined) {
                return;
            }
            ServiceStreams.writeTo(Buffer.from(rest), this._getSourceId(file)).catch(this._fail);
        });
        this._success();
    }

    private _getFilesWithoutValidDate(): string[] {
        const files: string[] = [];
        this._files.forEach((file: IFile) => {
            if (this._complited[file.file]) {
                return;
            }
            if (this._holders[file.file].hasValidDate()) {
                return;
            }
            files.push(file.file);
        });
        return files;
    }

    private _getFileWithEarliestTime(): string | undefined {
        let earliest: string | undefined;
        let unixtime: number | undefined;
        Object.keys(this._holders).forEach((file: string) => {
            const holder = this._holders[file];
            const hUnixtime: number | undefined = holder.getEarliestTime();
            if (hUnixtime === undefined) {
                return;
            }
            if (unixtime === undefined || unixtime > hUnixtime) {
                unixtime = hUnixtime;
                earliest = file;
            }
        });
        return earliest;
    }

    private _getSourceId(file: string) {
        return this._sourceIds[file] as number;
    }

    private _isComplited(file: string): boolean {
        return this._complited[file] as boolean;
    }

    private _isAllComplited(): boolean {
        let complited: boolean = true;
        this._files.forEach((file: IFile) => {
            if (!this._complited[file.file]) {
                complited = false;
            }
        });
        return complited;
    }

    private _success() {
        if (this._resolve === undefined) {
            return;
        }
        this._resolve(this._written);
        this.destroy();
    }

    private _fail(error: Error) {
        if (this._reject === undefined) {
            return;
        }
        this._reject(error);
        this.destroy();
    }

}
