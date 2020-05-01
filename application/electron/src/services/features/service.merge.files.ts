import ServiceElectron from '../service.electron';
import Logger from '../../tools/env.logger';
import ServiceStreams from "../service.streams";
import MergeFiles from '../../controllers/features/merge/merge.files';
import MergeDiscover from '../../controllers/features/merge/merge.discover';
import MergeFormat from '../../controllers/features/merge/merge.format';

import { IPCMessages } from '../service.electron';
import { Subscription } from '../../tools/index';
import { IService } from '../../interfaces/interface.service';
import { Progress } from "indexer-neon";
import { IFile as IMergeFileRequest } from '../../../../common/ipc/electron.ipc.messages/merge.files.request';
import { IMapItem } from '../../controllers/files.parsers/interface';

import * as moment from 'moment-timezone';

/**
 * @class ServiceMergeFiles
 * @description Providers access to merge files functionality from render
 */

class ServiceMergeFiles implements IService {

    private _logger: Logger = new Logger('ServiceMergeFiles');
    private _subscriptions: { [key: string]: Subscription } = {};
    private _tasks: {
        merge: Map<string, MergeFiles>,
    } = {
        merge: new Map<string, MergeFiles>(),
    };

    /**
     * Initialization function
     * @returns Promise<void>
     */
    public init(): Promise<void> {
        return new Promise((resolve, reject) => {
            Promise.all([
                ServiceElectron.IPC.subscribe(IPCMessages.MergeFilesRequest, this._onMergeFilesRequest.bind(this)).then((subscription: Subscription) => {
                    this._subscriptions.MergeFilesRequest = subscription;
                }),
                ServiceElectron.IPC.subscribe(IPCMessages.MergeFilesTestRequest, this._onMergeFilesTestRequest.bind(this)).then((subscription: Subscription) => {
                    this._subscriptions.MergeFilesTestRequest = subscription;
                }),
                ServiceElectron.IPC.subscribe(IPCMessages.MergeFilesTimezonesRequest, this._onMergeFilesTimezonesRequest.bind(this)).then((subscription: Subscription) => {
                    this._subscriptions.MergeFilesTimezonesRequest = subscription;
                }),
                ServiceElectron.IPC.subscribe(IPCMessages.MergeFilesDiscoverRequest, this._onMergeFilesDiscoverRequest.bind(this)).then((subscription: Subscription) => {
                    this._subscriptions.MergeFilesDiscoverRequest = subscription;
                }),
                ServiceElectron.IPC.subscribe(IPCMessages.MergeFilesFormatRequest, this._onMergeFilesFormatRequest.bind(this)).then((subscription: Subscription) => {
                    this._subscriptions.MergeFilesFormatRequest = subscription;
                }),
            ]).then(() => {
                this._subscriptions.onSessionClosed = ServiceStreams.getSubjects().onSessionClosed.subscribe(this._onSessionClosed.bind(this));
                resolve();
            }).catch((error: Error) => {
                this._logger.error(`Fail to init module due error: ${error.message}`);
                reject(error);
            });
        });
    }

    public destroy(): Promise<void> {
        return new Promise((resolve) => {
            Object.keys(this._subscriptions).forEach((key: string) => {
                this._subscriptions[key].destroy();
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
        const dest: { streamId: string; file: string } | Error = ServiceStreams.getStreamFile(req.session);
        if (dest instanceof Error) {
            return response(new IPCMessages.MergeFilesResponse({
                written: 0,
                id: req.id,
                error: `Fail merge file due error: ${dest.message}`,
            }));
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
                    req.id,
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
        }).cancel(() => {
            response(new IPCMessages.MergeFilesResponse({
                written: 0,
                id: req.id,
                error: `Operation is canceled`,
            }));
        }).finally(() => {
            this._tasks.merge.delete(req.session);
            ServiceStreams.removeProgressSession(req.id);
        });
        // Store task
        this._tasks.merge.set(req.session, controller);
    }

    private _onMergeFilesDiscoverRequest(request: IPCMessages.TMessage, response: (instance: IPCMessages.TMessage) => any) {
        const req: IPCMessages.MergeFilesDiscoverRequest = request as IPCMessages.MergeFilesDiscoverRequest;
        this._discover(req.files).then((processed: IPCMessages.IMergeFilesDiscoverResult[]) => {
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

    private _onMergeFilesFormatRequest(request: IPCMessages.TMessage, response: (instance: IPCMessages.TMessage) => any) {
        const req: IPCMessages.MergeFilesFormatRequest = request as IPCMessages.MergeFilesFormatRequest;
        this._format(req.format).then(() => {
            response(new IPCMessages.MergeFilesFormatResponse({
            }));
        }).catch((error: Error) => {
            response(new IPCMessages.MergeFilesFormatResponse({
                error: error.message,
            }));
        });
    }

    private _onMergeFilesTestRequest(request: IPCMessages.TMessage, response: (instance: IPCMessages.TMessage) => any) {
        const req: IPCMessages.MergeFilesTestRequest = request as IPCMessages.MergeFilesTestRequest;
        this._test(req.file, req.format, req.year).then((results: IPCMessages.IMergeFilesDiscoverResult) => {
            response(new IPCMessages.MergeFilesTestResponse({
                id: req.id,
                format: results.format,
                error: results.error,
                maxTime: results.maxTime,
                minTime: results.minTime,
                path: req.file,
            }));
        }).catch((error: Error) => {
            response(new IPCMessages.MergeFilesTestResponse({
                id: req.id,
                error: error.message,
                path: req.file,
            }));
        });
    }

    private _test(file: string, format: string | undefined, year: number | undefined): Promise<IPCMessages.IMergeFilesDiscoverResult> {
        return new Promise((resolve, reject) => {
            const controller: MergeDiscover = new MergeDiscover([{ file: file, format: format, year: year }]);
            controller.discover().then((processed: IPCMessages.IMergeFilesDiscoverResult[]) => {
                if (processed.length !== 1) {
                    return reject(new Error(`Unexpected count of results: ${processed.length}. Expected 1.`));
                }
                resolve(processed[0]);
            }).catch((error: Error) => {
                reject(error);
            });
        });
    }

    private _discover(files: string[]): Promise<IPCMessages.IMergeFilesDiscoverResult[]> {
        return new Promise((resolve, reject) => {
            const controller: MergeDiscover = new MergeDiscover(files.map((file: string) => {
                return { file: file };
            }));
            controller.discover().then((processed: IPCMessages.IMergeFilesDiscoverResult[]) => {
                resolve(processed);
            }).catch((error: Error) => {
                reject(error);
            });
        });
    }

    private _format(format: string): Promise<void> {
        return new Promise((resolve, reject) => {
            const controller: MergeFormat = new MergeFormat(format);
            controller.validate().then(() => {
                resolve();
            }).catch((error: Error) => {
                reject(error);
            });
        });
    }

    private _onSessionClosed(guid: string) {
        // Checking for active task
        const controller: MergeFiles | undefined = this._tasks.merge.get(guid);
        if (controller === undefined) {
            return;
        }
        controller.abort().then(() => {
            this._logger.debug(`Task is aborted`);
        });
    }

}

export default (new ServiceMergeFiles());
