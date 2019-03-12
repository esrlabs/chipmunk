import { Fragment, IResults } from './controller.stream.search.engine';
import { EventEmitter } from 'events';
import Logger from '../../platform/node/src/env.logger';
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
            // Storage of results
            const result: IResults = {
                found: 0,
                regs: {},
                end: -1,
                begin: 0,
            };
            // Offset in file. We need it to correctly calculate numbers of rows
            let offset = 0;
            // Create stream to read a target file
            this._stream = fs.createReadStream(this._file, { encoding: 'utf8' });
            this.emit(ControllerStreamSearch.Events.started);
            this._stream.on('data', (chunk: string) => {
                const fragment: Fragment = new Fragment(offset, 1000000, chunk);
                const res: IResults | Error = fragment.find(this._requests);
                if (res instanceof Error) {
                    if (this._stream !== undefined) {
                        this._stream.close();
                        this._stream.removeAllListeners();
                        this._stream = undefined;
                    }
                    this.emit(ControllerStreamSearch.Events.finished);
                    return reject(new Error(this._logger.warn(`Cannot continue search due error: ${res.message}`)));
                }
                result.found += res.found;
                result.end = res.end;
                offset = res.end;
                Object.keys(res.regs).forEach((reg: string) => {
                    const index: number = parseInt(reg, 10);
                    if (result.regs[index] === undefined) {
                        result.regs[index] = res.regs[index];
                    } else {
                        result.regs[index].push(...res.regs[index]);
                    }
                });
                this.emit(ControllerStreamSearch.Events.next, res);
            });
            this._stream.on('end', () => {
                this.emit(ControllerStreamSearch.Events.finished, result);
                resolve(result);
            });
        });
    }

}
