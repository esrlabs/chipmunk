import ServiceElectron, { IPCMessages } from './service.electron';
import ServiceFileParsers from './service.file.parsers';
import { AFileParser } from '../controllers/files.parsers/index';
import Logger from '../tools/env.logger';
import * as fs from 'fs';
import { Subscription } from '../tools/index';
import { IService } from '../interfaces/interface.service';
import TestTransform, { IResults as ITestResults} from '../controllers/controller.merge.files.test.pipe.transform';
import NullWritableStream from '../classes/stream.writable.null';
import { IFile as ITestFileRequest } from '../controllers/electron.ipc.messages/merge.files.test.request';
import { IFile as IMergeFileRequest } from '../controllers/electron.ipc.messages/merge.files.request';
import * as Stream from 'stream';
import * as moment from 'moment-timezone';
import MergeFilesWriter from '../controllers/controller.merge.files.writer';

export interface ITestFileResults {
    file: string;
    reg: string;
    size: number;
    found: number;
    read: number;
    first: string | undefined;
    last: string | undefined;
    errors: string[];
}

const Settings = {
    readBytesForTest: 64 * 1024,
};

/**
 * @class ServiceMergeFiles
 * @description Providers access to merge files functionality from render
 */

class ServiceMergeFiles implements IService {

    private _logger: Logger = new Logger('ServiceMergeFiles');
    // Should detect by executable file
    private _subscription: { [key: string]: Subscription } = {};

    /**
     * Initialization function
     * @returns Promise<void>
     */
    public init(): Promise<void> {
        return new Promise((resolve, reject) => {
            Promise.all([
                new Promise((resolveSubscription, rejectSubscription) => {
                    ServiceElectron.IPC.subscribe(IPCMessages.MergeFilesRequest, this._onMergeFilesRequest.bind(this)).then((subscription: Subscription) => {
                        this._subscription.MergeFilesRequest = subscription;
                        resolveSubscription();
                    }).catch((error: Error) => {
                        this._logger.error(`Fail to init module due error: ${error.message}`);
                        rejectSubscription(error);
                    });
                }),
                new Promise((resolveSubscription, rejectSubscription) => {
                    ServiceElectron.IPC.subscribe(IPCMessages.MergeFilesTestRequest, this._onMergeFilesTestRequest.bind(this)).then((subscription: Subscription) => {
                        this._subscription.MergeFilesTestRequest = subscription;
                        resolveSubscription();
                    }).catch((error: Error) => {
                        this._logger.error(`Fail to init module due error: ${error.message}`);
                        rejectSubscription(error);
                    });
                }),
                new Promise((resolveSubscription, rejectSubscription) => {
                    ServiceElectron.IPC.subscribe(IPCMessages.MergeFilesTimezonesRequest, this._onMergeFilesTimezonesRequest.bind(this)).then((subscription: Subscription) => {
                        this._subscription.MergeFilesTimezonesRequest = subscription;
                        resolveSubscription();
                    }).catch((error: Error) => {
                        this._logger.error(`Fail to init module due error: ${error.message}`);
                        rejectSubscription(error);
                    });
                }),
            ]).then(() => {
                resolve();
            }).catch((error: Error) => {
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
        return 'ServiceMergeFiles';
    }

    private _onMergeFilesTimezonesRequest(request: IPCMessages.TMessage, response: (instance: IPCMessages.TMessage) => any) {
        response(new IPCMessages.MergeFilestimezoneResponse({
            zones: moment.tz.names(),
        }));
    }

    private _onMergeFilesRequest(request: IPCMessages.TMessage, response: (instance: IPCMessages.TMessage) => any) {
        const req: IPCMessages.MergeFilesRequest = request as IPCMessages.MergeFilesRequest;
        const writer: MergeFilesWriter = new MergeFilesWriter(req.files.map((file: IMergeFileRequest) => {
            const regexp: RegExp = new RegExp(file.timestampReg, 'gi');
            return {
                file: file.file,
                format: file.format,
                timestamp: regexp,
                offset: file.offset,
                parser: file.parser,
            };
        }));
        writer.write().then((written: number) => {
            response(new IPCMessages.MergeFilesResponse({
                written: written,
                id: req.id,
            }));
        }).catch((writeError: Error) => {
            response(new IPCMessages.MergeFilesResponse({
                written: 0,
                id: req.id,
                error: writeError.message,
            }));
        });
    }

    private _onMergeFilesTestRequest(request: IPCMessages.TMessage, response: (instance: IPCMessages.TMessage) => any) {
        const req: IPCMessages.MergeFilesTestRequest = request as IPCMessages.MergeFilesTestRequest;
        const files: ITestFileResults[] = [];
        Promise.all(req.files.map((file: ITestFileRequest) => {
            return new Promise((resolve) => {
                this._test(file.file, file.timestampReg, file.parser, file.offset, file.format).then((testResult: ITestFileResults) => {
                    files.push(testResult);
                    resolve();
                }).catch((testError: Error) => {
                    files.push({
                        file: file.file,
                        size: -1,
                        read: 0,
                        found: 0,
                        errors: [ testError.message ],
                        first: undefined,
                        last: undefined,
                        reg: file.timestampReg,
                    });
                    resolve();
                });
            });
        })).then(() => {
            response(new IPCMessages.MergeFilesTestResponse({
                id: req.id,
                files: files,
            }));
        });

    }

    private _test(file: string, reg: string, parserName: string, offset: number, format: string): Promise<ITestFileResults> {
        return new Promise((resolve, reject) => {
            // Get file parser
            const parserClass = ServiceFileParsers.getParser(parserName);
            if (parserClass === undefined) {
                return reject(new Error(`Fail to find parser "${parserName}". Cannot open file.`));
            }
            const fileParser: AFileParser = new parserClass();
            // Get basic transformer for file
            const fileTransform: Stream.Transform | undefined = fileParser.getTransform();
            // Create regexp for timestamp
            let regext: RegExp;
            try {
                regext = new RegExp(reg, 'gi');
            } catch (regexpCreateError) {
                return reject(regexpCreateError.message);
            }
            fs.stat(file, (error: NodeJS.ErrnoException | null, stats: fs.Stats) => {
                if (error) {
                    return;
                }
                // Create read stream
                const reader: fs.ReadStream = fs.createReadStream(file, {
                    start: 0,
                    end: Settings.readBytesForTest > stats.size ? stats.size - 1 : Settings.readBytesForTest,
                });
                // Create writer
                const writer: NullWritableStream = new NullWritableStream();
                // Create transformer
                const transform: TestTransform = new TestTransform({}, file, regext, offset, format);
                // Listenn end of reading
                reader.once('end', () => {
                    const results: ITestResults = transform.getResults();
                    resolve({
                        file: file,
                        size: stats.size,
                        read: results.read,
                        found: results.found,
                        errors: results.errors,
                        first: results.first === undefined ? undefined : results.first.toLocaleString(),
                        last: results.last === undefined ? undefined : results.last.toLocaleString(),
                        reg: reg,
                    });
                });
                // Listen error on reading
                reader.once('error', (readError: Error) => {
                    reject(new Error(this._logger.error(`Fail to read file due error: ${readError.message}`)));
                });
                // Execute operation
                if (fileTransform === undefined) {
                    reader.pipe(transform).pipe(writer, { end: false });
                } else {
                    reader.pipe(fileTransform).pipe(transform).pipe(writer, { end: false });
                }
            });
        });
    }

}

export default (new ServiceMergeFiles());
