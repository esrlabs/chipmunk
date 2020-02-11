import * as fs from 'fs';
import Logger from '../../tools/env.logger';

export default class ControllerStreamFileReader {

    private _logger: Logger;
    private _guid: string;
    private _file: string;
    private _stream: fs.ReadStream | undefined;

    constructor(guid: string, file: string) {
        this._guid = guid;
        this._file = file;
        this._logger = new Logger(`ControllerStreamFileReader: ${this._guid}/${this._file}`);
    }

    public destroy() {
        this.close();
    }

    public close() {
        if (this._stream === undefined) {
            return;
        }
        this._stream.removeAllListeners();
        this._stream.close();
        this._stream.destroy();
        this._stream = undefined;
    }

    /**
     * Reads file from "from" to "to" bytes
     * @param from byte to star reading
     * @param to byte to finish reading
     * @returns Promise<string>
     */
    public read(from: number, to: number): Promise<string> {
        return new Promise((resolve, reject) => {
            fs.stat(this._file, (err: NodeJS.ErrnoException | null, stat: fs.Stats) => {
                if (err) {
                    return reject(err);
                }
                const options: { [key: string]: any } = { autoClose: true, encoding: 'utf8' };
                if (to < 0) {
                    return reject(new Error(this._logger.error(`Both parameters (from, to) cannot be < 0`)));
                }
                if (from < 0) {
                    // Reading from end
                    options.start = stat.size - to;
                    options.end = stat.size - 1;
                } else if (from >= 0 && to > 0) {
                    // Reading in a middle
                    options.start = from;
                    options.end = to;
                }
                let output: string = '';
                this._stream = fs.createReadStream(this._file, options);
                this._stream.on('data', (chunk: string) => {
                    output += chunk;
                    if (this._stream !== undefined && this._stream.bytesRead >= (options.end - options.start)) {
                        this.close();
                        resolve(output);
                    }
                });
                this._stream.on('end', () => {
                    this.close();
                    fs.stat(this._file, (statErr: NodeJS.ErrnoException | null, updatedStat: fs.Stats) => {
                        if (statErr) {
                            this._logger.warn(`Reader finished read data unexpectable. Requested: ${options.start} - ${options.end}. Fail get stat file information due error: ${statErr.message}`);
                        } else {
                            this._logger.warn(`Reader finished read data unexpectable. File size: ${updatedStat.size} bytes. Requested: ${options.start} - ${options.end}`);
                        }
                        resolve(output);
                    });
                });
            });
        });
    }

}
