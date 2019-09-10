import ServiceElectron, { IPCMessages } from './service.electron';
import Logger from '../tools/env.logger';
import { Subscription } from '../tools/index';
import { IService } from '../interfaces/interface.service';
import { IFile as ITestFileRequest } from '../controllers/electron.ipc.messages/merge.files.test.request';
import { IFile as ITestFileResponse } from '../controllers/electron.ipc.messages/merge.files.test.response';
import { IFile as IMergeFileRequest } from '../controllers/electron.ipc.messages/merge.files.request';
import * as moment from 'moment-timezone';
import MergeFiles from '../controllers/controller.merge.files';
import MergeDiscover, { IDatetimeDiscoverResult } from '../controllers/controller.merge.discover';
import MergeTest, { IFileTestResults } from '../controllers/controller.merge.test';
import { IDatetimeDiscoverFileResult } from '../controllers/controller.lvin';

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
                new Promise((resolveSubscription, rejectSubscription) => {
                    ServiceElectron.IPC.subscribe(IPCMessages.MergeFilesDiscoverRequest, this._onMergeFilesDiscoverRequest.bind(this)).then((subscription: Subscription) => {
                        this._subscription.MergeFilesDiscoverRequest = subscription;
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
        const controller: MergeFiles = new MergeFiles(
            req.files.map((file: IMergeFileRequest) => {
                return {
                    file: file.file,
                    offset: file.offset,
                    parser: file.parser,
                    year: file.year,
                    format: file.format,
                };
            }),
        );
        controller.write().then((written: number) => {
            response(new IPCMessages.MergeFilesResponse({
                written: written,
                id: req.id,
            }));
        }).catch((mergeError: Error) => {
            response(new IPCMessages.MergeFilesResponse({
                written: 0,
                id: req.id,
                error: mergeError.message,
            }));
        });
    }

    private _onMergeFilesDiscoverRequest(request: IPCMessages.TMessage, response: (instance: IPCMessages.TMessage) => any) {
        const req: IPCMessages.MergeFilesDiscoverRequest = request as IPCMessages.MergeFilesDiscoverRequest;
        this._discover(req.files).then((processed: IDatetimeDiscoverFileResult[]) => {
            response(new IPCMessages.MergeFilesDiscoverResponse({
                id: req.id,
                files: processed,
            }));
        }).catch((error: Error) => {
            response(new IPCMessages.MergeFilesDiscoverResponse({
                id: req.id,
                files: [],
                error: error.message,
            }));
        });
    }

    private _onMergeFilesTestRequest(request: IPCMessages.TMessage, response: (instance: IPCMessages.TMessage) => any) {
        const req: IPCMessages.MergeFilesTestRequest = request as IPCMessages.MergeFilesTestRequest;
        const files: ITestFileResponse[] = [];
        Promise.all(req.files.map((requestFile: ITestFileRequest) => {
            return new Promise((resolve) => {
                this._test(requestFile).then((responseFile: ITestFileResponse) => {
                    files.push(responseFile);
                    resolve();
                }).catch((error: Error) => {
                    files.push({
                        file: requestFile.file,
                        found: -1,
                        readBytes: -1,
                        readRows: -1,
                        size: -1,
                        regExpStr: '',
                        error: error.message,
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

    private _test(file: ITestFileRequest): Promise<ITestFileResponse> {
        return new Promise((resolve, reject) => {
            const controller: MergeTest = new MergeTest({
                file: file.file,
                format: file.format,
                rowsToBeRead: 500,
            });
            controller.test().then((results: IFileTestResults) => {
                if (results.results.readBytes === 0) {
                    return reject(`Fail to read file. Was read ${results.results.readBytes} bytes.`);
                }
                resolve({
                    file: file.file,
                    found: results.results.matches,
                    readBytes: results.results.readBytes,
                    readRows: results.results.readRows,
                    size: results.size,
                    regExpStr: results.results.regExpStr,
                });
            }).catch((error: Error) => {
                reject(error);
            });
        });
    }

    private _discover(files: string[]): Promise<IDatetimeDiscoverFileResult[]> {
        return new Promise((resolve, reject) => {
            const controller: MergeDiscover = new MergeDiscover(files);
            controller.discover().then((processed: IDatetimeDiscoverFileResult[]) => {
                resolve(processed);
            }).catch((error: Error) => {
                reject(error);
            });
        });
    }

}

export default (new ServiceMergeFiles());
