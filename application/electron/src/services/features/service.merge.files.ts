import ServiceElectron, { IPCMessages } from '../service.electron';
import Logger from '../../tools/env.logger';
import { Subscription } from '../../tools/index';
import { IService } from '../../interfaces/interface.service';
import ServiceStreams from "../service.streams";
import { IFile as ITestFileRequest } from '../../../../ipc/electron.ipc.messages/merge.files.test.request';
import { Progress } from "indexer-neon";
import { IFile as ITestFileResponse } from '../../../../ipc/electron.ipc.messages/merge.files.test.response';
import { IFile as IMergeFileRequest } from '../../../../ipc/electron.ipc.messages/merge.files.request';
import * as moment from 'moment-timezone';
import * as Tools from "../../tools/index";
import MergeFiles from '../../controllers/features/merge/merge.files';
import MergeDiscover, { IDatetimeDiscoverResult } from '../../controllers/features/merge/merge.discover';
import { IDatetimeDiscoverFileResult } from '../../controllers/external/controller.lvin';
import { IMapItem } from '../../controllers/files.parsers/interface';

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
        const trackingId: string = Tools.guid();
        // Get destination file TODO dmitry: please re-check
        const dest: { streamId: string; file: string } | Error = ServiceStreams.getStreamFile();
        if (dest instanceof Error) {
            throw dest;
        }
        const controller: MergeFiles = new MergeFiles(
            req.session,
            req.files.map((file: IMergeFileRequest) => {
                return {
                    file: file.file,
                    offset: file.offset,
                    parser: file.parser,
                    year: file.year,
                    format: file.format,
                };
            }),
            (ticks: Progress.ITicks) => {
                ServiceStreams.updateProgressSession(
                    trackingId,
                    ticks.ellapsed / ticks.total,
                    req.session,
                );
            },
        );
        controller.write((map: IMapItem[]) => {
                ServiceStreams.pushToStreamFileMap(dest.streamId, map);
            }).then((written: number) => {
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
            reject("no test implementend");
            // const controller: MergeTest = new MergeTest({
            //     file: file.file,
            //     format: file.format,
            //     rowsToBeRead: 500,
            // });
            // controller.test().then((results: IFileTestResults) => {
            //     if (results.results.readBytes === 0) {
            //         return reject(`Fail to read file. Was read ${results.results.readBytes} bytes.`);
            //     }
            //     resolve({
            //         file: file.file,
            //         found: results.results.matches,
            //         readBytes: results.results.readBytes,
            //         readRows: results.results.readRows,
            //         size: results.size,
            //         regExpStr: results.results.regExpStr,
            //     });
            // }).catch((error: Error) => {
            //     reject(error);
            // });
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
