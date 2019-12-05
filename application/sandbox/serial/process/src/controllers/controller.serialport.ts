import * as SerialPort from 'serialport';
import Logger from '../env/env.logger';
import { EventEmitter } from 'events';

export interface IPortOptions {
    autoOpen?: boolean;
    baudRate?: 115200|57600|38400|19200|9600|4800|2400|1800|1200|600|300|200|150|134|110|75|50|number;
    dataBits?: 8|7|6|5;
    highWaterMark?: number;
    lock?: boolean;
    stopBits?: 1|2;
    parity?: 'none'|'even'|'mark'|'odd'|'space';
    rtscts?: boolean;
    xon?: boolean;
    xoff?: boolean;
    xany?: boolean;
    // binding?: BaseBinding;
    bindingOptions?: {
        vmin?: number;
        vtime?: number;
    };

}

export interface IOptions {
    path: string;
    options: SerialPort.OpenOptions;
    reader?: {
        delimiter: string | Buffer | number[];
        encoding?: "ascii" | "utf8" | "utf16le" | "ucs2" | "base64" | "binary" | "hex" | undefined;
        includeDelimiter?: boolean | undefined;
    }
}

export interface IIOState {
    read: number;
    written: number;
}

const CDelimiters = {
    name: '\u0004',
};

export class ControllerSerialPort extends EventEmitter {

    public static Events = {
        data: 'data',
        disconnect: 'disconnect',
        error: 'error'
    };

    private _port: SerialPort | undefined;
    private _options: IOptions;
    private _reader: SerialPort.parsers.Readline | undefined;
    private _logger: Logger;
    private _read: number = 0;
    private _written: number = 0;
    private _signature: boolean = false;
    private _timeout: number = 50;
    private _size: number = 1;

    constructor(options: IOptions, port?: SerialPort) {
        super();
        this._options = options;
        this._logger = new Logger(`ControllerSerialPort: ${options.path}`);
        if (port instanceof SerialPort) {
            this._port = port;
            this._refPortEvents(port);
        }
        this._onDataChunk = this._onDataChunk.bind(this);
        this._onPortError = this._onPortError.bind(this);
        this._onPortClose = this._onPortClose.bind(this);
    }

    public destroy(): Promise<void> {
        return new Promise((resolve, reject) => {
            if (this._port === undefined || this._reader === undefined) {
                return resolve();
            }
            this._reader.removeAllListeners();
            this._port.removeAllListeners();
            this._port.unpipe(this._reader);
            this._port.close((error: Error | null | undefined) => {
                this._logger.verbose("Successfully closed!");
                this._port = undefined;
                this._reader = undefined;
                if (error) {
                    return reject(this._logger.error(`Fail correctly close a port due error: ${error.message}`));
                }
                resolve();
            });
        });
    }

    public open(): Promise<void> {
        return new Promise((resolve, reject) => {
            if (this._port !== undefined) {
                return reject(new Error(this._logger.error(`Port is already exist.`)));
            }
            const optErrs: Error | undefined = this._getOptionsErrors(this._options);
            if (optErrs) {
                return reject(new Error(this._logger.error(`Error opening port, because options aren't valid: ${optErrs.message}`)));
            }
            this._port = new SerialPort(this._options.path, this._options.options, (error: Error | undefined | null) => {
                if (error) {
                    return reject(new Error(this._logger.error(`Fail to open serial port due error: ${error.message}`)));
                }
                this._refPortEvents(this._port as SerialPort);
                this._logger.error(`Connection to port "${this._options.path}" is successfull`);
                resolve();
            });
        });
    }

    public write(chunk: Buffer | string): Promise<void> {
        return new Promise((resolve, reject) => {
            if (this._port === undefined) {
                return reject(new Error(this._logger.error(`Fail to write in port ${this._options.path} because port isn't inited`)));
            }
            if (typeof chunk === 'string' && chunk.length > 0){
                chunk = chunk.replace(/\r?\n|\r/gi, '');
                let bufferIn    = chunk.substr(0,this._size),
                    bufferOut   = chunk.substr(this._size, chunk.length);
                    setTimeout(() => {
                        if(this._port === undefined) {
                            return;
                        }
                        this._port.write(bufferIn + (bufferOut === '' ? '\n\r' : ''), (error: Error | null | undefined) => {
                            if (error) {
                                return reject(new Error(this._logger.error(`Fail to write into port due error: ${error.message}`)));
                            }
                            if(this._port === undefined) {
                                return reject(new Error(this._logger.error(`Fail to write in port ${this._options.path} because port isn't inited`)));
                            }
                            this._port.drain(() => {
                                this._written += bufferIn.length;
                                this.write(bufferOut);
                            });
                        });
                    }, this._timeout);
            }
            resolve();
        });
    }

    public getIOState(): IIOState {
        return {
            read: this._read,
            written: this._written,
        }
    }

    public getPath(): string {
        return this._options.path;
    }

    public setSignature(value: boolean){
        this._signature = value;
    }

    private _refPortEvents(port: SerialPort) {
        // Create reader
        this._reader = new SerialPort.parsers.Readline(this._options.reader === undefined ? { delimiter: '\n'} : this._options.reader);
        // Add listener
        this._reader.on('data', this._onDataChunk);
        // Pipe reader
        port.pipe(this._reader);
        // Other listeners
        port.on('error', this._onPortError);
        port.on('close', this._onPortClose);
    }

    private _onDataChunk(chunk: string | Buffer) {
        if (chunk instanceof Buffer) {
            chunk = chunk.toString();
        }
        if (typeof chunk === 'string') {
            if (this._signature) {
                chunk = Buffer.from(chunk.split(/[\n\r]/gi).filter((row: string) => {
                    return row !== '';
                }).map((row: string) => {
                    return `${CDelimiters.name}${this._options.path}${CDelimiters.name}: ${row}\n`;
                }).join(''));
            } else {
                chunk = Buffer.from(`${chunk}\n`);
            }
        }
        if (!(chunk instanceof Buffer)) {
            return;
        }
        this._read = chunk.byteLength;
        this.emit(ControllerSerialPort.Events.data, chunk);
    }

    private _onPortError(error: Error) {
        this.destroy().catch((destroyErr: Error) => {
            this._logger.error(`Fail to destroy port due error: ${destroyErr.message}`);
        }).finally(() => {
            this.emit(ControllerSerialPort.Events.error, error);
        });
    }

    private _onPortClose() {
        this.destroy().catch((destroyErr: Error) => {
            this._logger.error(`Fail to destroy port due error: ${destroyErr.message}`);
        }).finally(() => {
            this.emit(ControllerSerialPort.Events.disconnect);
        });
    }

    private _getOptionsErrors(options: IOptions): Error | undefined {
        const errors: string[] = [];
        if (typeof options.path !== 'string' || options.path.trim() === '') {
            errors.push(`Path should be defined as string. Gotten type: "${typeof options.path}"`);
        }
        return errors.length > 0 ? new Error(errors.join('\n\t- ')) : undefined;
    }
}