import { Fragment, IResults } from './controller.stream.search.engine';
import { EventEmitter } from 'events';
import Logger from '../tools/env.logger';
import * as fs from 'fs';

export { IResults };

export default class ControllerStreamSearch extends EventEmitter {

    public static Events = {
        next: 'next',
        started: 'started',
        finished: 'finished',
    };

    private _logger: Logger = new Logger('ControllerStreamSearch');
    private _file: string;
    private _requests: RegExp[];
    private _stream: fs.ReadStream | undefined;

    constructor(file: string, requests: RegExp[]) {
        super();
        this._file = file;
        this._requests = requests;
    }

    public search(): Promise<IResults> {
        return new Promise((resolve, reject) => {
            const done = () => {
                if (this._stream === undefined) {
                    return;
                }
                this._stream.close();
                this._stream.removeAllListeners();
                this._stream = undefined;
                if (restFromChunkEnd !== '') {
                    const res: IResults | Error = this._findInChunk(restFromChunkEnd, result);
                    if (res instanceof Error) {
                        this.emit(ControllerStreamSearch.Events.finished);
                        return reject(new Error(this._logger.warn(`Cannot continue search due error: ${res.message}`)));
                    }
                }
                this.emit(ControllerStreamSearch.Events.finished, result);
                resolve(result);
            };
            // To store rest of each chunk
            let restFromChunkEnd = '';
            // Storage of results
            const result: IResults = {
                found: 0,
                regs: {},
                str: '',
            };
            // Offset in file. We need it to correctly calculate numbers of rows
            // Get file info
            const stat: fs.Stats = fs.statSync(this._file);
            // Create stream to read a target file
            this._stream = fs.createReadStream(this._file, { encoding: 'utf8' });
            this.emit(ControllerStreamSearch.Events.started);
            this._stream.on('data', (chunk: string) => {
                // Append to the beggining of chunk rest part from previous
                chunk = `${restFromChunkEnd}${chunk}`;
                // Remove last row in chunk because it could be not finished
                const rows: string[] = chunk.split(/\r?\n|\r/gi);
                restFromChunkEnd = rows[rows.length - 1];
                rows.splice(rows.length - 1, 1);
                chunk = rows.join('\n');
                // Start search
                const res: IResults | Error = this._findInChunk(chunk, result);
                if (res instanceof Error) {
                    done();
                    this.emit(ControllerStreamSearch.Events.finished);
                    return reject(new Error(this._logger.warn(`Cannot continue search due error: ${res.message}`)));
                }

                result.str = ''; // !!!!!! <==== HAS TO BE REMOVED
                // Emit event about middle results
                this.emit(ControllerStreamSearch.Events.next, res);
                // Check: is stream already finished
                if (this._stream !== undefined && this._stream.bytesRead === stat.size) {
                    // Whole file is read. If stream still is available - event "end" wasn't triggered.
                    done();
                }
            });
            this._stream.on('end', () => {
                done();
            });
        });
    }

    private _findInChunk(chunk: string, results: IResults): Error | IResults {
        const fragment: Fragment = new Fragment(1000000, chunk);
        const res: IResults | Error = fragment.find(this._requests);
        if (res instanceof Error) {
            return res;
        }
        results.found += res.found;
        results.str += res.str;
        Object.keys(res.regs).forEach((reg: string) => {
            const index: number = parseInt(reg, 10);
            if (results.regs[index] === undefined) {
                results.regs[index] = res.regs[index];
            } else {
                results.regs[index].push(...res.regs[index]);
            }
        });
        return res;
    }

}
