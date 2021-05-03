import ServiceElectron, { IPCMessages } from '../service.electron';
import Logger from '../../tools/env.logger';
import * as fs from 'fs';
import { Subscription } from '../../tools/index';
import { IService } from '../../interfaces/interface.service';

/**
 * @class ServiceFileReader
 * @description Providers access to files
 */

class ServiceFileReader implements IService {

    private _logger: Logger = new Logger('ServiceFileReader');
    // Should detect by executable file
    private _subscription: { [key: string]: Subscription } = {};

    /**
     * Initialization function
     * @returns Promise<void>
     */
    public init(): Promise<void> {
        return new Promise((resolve, reject) => {
            ServiceElectron.IPC.subscribe(IPCMessages.FileReadRequest, this._onFileReadRequest.bind(this)).then((subscription: Subscription) => {
                this._subscription.FileReadRequest = subscription;
                resolve();
            }).catch((error: Error) => {
                this._logger.error(`Fail to init module due error: ${error.message}`);
                reject(error);
            });
        });
    }

    public destroy(): Promise<void> {
        return new Promise((resolve) => {
            Object.keys(this._subscription).forEach((key: string) => {
                this._subscription[key].destroy();
            });
            resolve();
        });
    }

    public getName(): string {
        return 'ServiceFileReader';
    }

    private _onFileReadRequest(request: IPCMessages.TMessage, response: (instance: IPCMessages.TMessage) => any) {
        const req: IPCMessages.FileReadRequest = request as IPCMessages.FileReadRequest;
        fs.stat(req.file, (error: NodeJS.ErrnoException | null, stats: fs.Stats) => {
            if (error) {
                return response(new IPCMessages.FileReadResponse({
                    size: 0,
                    error: error.message,
                    content: '',
                }));
            }
            this._read(req.file, req.bytes > stats.size ? stats.size : req.bytes).then((content: string) => {
                response(new IPCMessages.FileReadResponse({
                    size: stats.size,
                    content: content,
                }));
            }).catch((readingError: Error) => {
                response(new IPCMessages.FileReadResponse({
                    size: 0,
                    error: readingError.message,
                    content: '',
                }));
            });
        });
    }

    private _read(file: string, bytes: number): Promise<string> {
        return new Promise((resolve, reject) => {
            const options: { [key: string]: any } = { autoClose: true, encoding: 'utf8', start: 0, end: bytes };
            let output: string = '';
            const stream = fs.createReadStream(file, options);
            stream.on('data', (chunk: string) => {
                output += chunk;
                if (stream !== undefined && stream.bytesRead >= (options.end - options.start)) {
                    stream.close();
                    stream.removeAllListeners();
                    resolve(output);
                }
            });
            stream.on('end', () => {
                if (stream !== undefined) {
                    stream.close();
                    stream.removeAllListeners();
                }
                resolve(output);
            });
        });
    }

}

export default (new ServiceFileReader());
