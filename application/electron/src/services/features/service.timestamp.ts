import ServiceElectron from '../service.electron';
import Logger from '../../tools/env.logger';
import ServiceStreams from "../service.sessions";
import ServiceTimestampFormatRecent from './service.timestamp.recent';

import { IPCMessages } from '../service.electron';
import { Subscription } from '../../tools/index';
import { IService } from '../../interfaces/interface.service';
import { dialog, SaveDialogReturnValue } from 'electron';

/**
 * @class ServiceTimestamp
 * @description Providers access to merge files functionality from render
 */

class ServiceTimestamp implements IService {

    private _logger: Logger = new Logger('ServiceTimestamp');
    private _subscriptions: { [key: string]: Subscription } = {};
    // private _tasks: Map<string, Map<string, MergeDiscover>> = new Map<string, Map<string, MergeDiscover>>();

    /**
     * Initialization function
     * @returns Promise<void>
     */
    public init(): Promise<void> {
        return new Promise((resolve, reject) => {
            /*
            Promise.all([
                ServiceElectron.IPC.subscribe(IPCMessages.TimestampDiscoverRequest, this._onTimestampDiscoverRequest.bind(this)).then((subscription: Subscription) => {
                    this._subscriptions.TimestampDiscoverRequest = subscription;
                }),
                ServiceElectron.IPC.subscribe(IPCMessages.TimestampTestRequest, this._onTimestampTestRequest.bind(this)).then((subscription: Subscription) => {
                    this._subscriptions.TimestampTestRequest = subscription;
                }),
                ServiceElectron.IPC.subscribe(IPCMessages.TimestampExtractRequest, this._onTimestampExtractRequest.bind(this)).then((subscription: Subscription) => {
                    this._subscriptions.TimestampExtractRequest = subscription;
                }),
                ServiceElectron.IPC.subscribe(IPCMessages.TimestampExportCSVRequest, this._onTimestampExportCSVRequest.bind(this)).then((subscription: Subscription) => {
                    this._subscriptions.TimestampExportCSVRequest = subscription;
                }),
            ]).then(() => {
                this._subscriptions.onSessionClosed = ServiceStreams.getSubjects().onSessionClosed.subscribe(this._onSessionClosed.bind(this));
                resolve();
            }).catch((error: Error) => {
                this._logger.error(`Fail to init module due error: ${error.message}`);
                reject(error);
            });
            */
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
        return 'ServiceTimestamp';
    }

    private _onTimestampDiscoverRequest(request: IPCMessages.TMessage, response: (instance: IPCMessages.TMessage) => any) {
        /*
        const req: IPCMessages.TimestampDiscoverRequest = request as IPCMessages.TimestampDiscoverRequest;
        const filedata: { streamId: string, file: string } | Error = ServiceStreams.getStreamFile(req.session);
        if (filedata instanceof Error) {
            return response(new IPCMessages.TimestampDiscoverResponse({
                id: req.id,
                error: filedata.message,
            }));
        }
        fs.stat(filedata.file, (err: NodeJS.ErrnoException | null, stats: fs.Stats) => {
            if (err) {
                return response(new IPCMessages.TimestampDiscoverResponse({
                    id: req.id,
                    error: `Fail to get access to session file due error: ${err.message}`,
                }));
            }
            if (stats.size === 0) {
                return response(new IPCMessages.TimestampDiscoverResponse({
                    id: req.id,
                    error: `Session is empty`,
                }));
            }
            const controller: MergeDiscover = new MergeDiscover([{ file: filedata.file }]);
            controller.discover(undefined, true).then((processed: IPCMessages.IMergeFilesDiscoverResult[]) => {
                if (processed[0].format === undefined || typeof processed[0].minTime !== 'number' || typeof processed[0].maxTime !== 'number') {
                    return response(new IPCMessages.TimestampDiscoverResponse({
                        id: req.id,
                        error: typeof processed[0].error !== 'string' ? `Fail to detect datetime format` : processed[0].error,
                    }));
                }
                response(new IPCMessages.TimestampDiscoverResponse({
                    id: req.id,
                    format: processed[0].format,
                    error: processed[0].error,
                    minTime: processed[0].minTime,
                    maxTime: processed[0].maxTime,
                }));
            }).catch((error: Error) => {
                response(new IPCMessages.TimestampDiscoverResponse({
                    id: req.id,
                    error: error.message,
                }));
            }).finally(() => {
                this._removeTask(req.signature, req.id);
            });
            // Store task
            this._addTask(req.signature, req.id, controller);
        });
        */
    }

    private _onTimestampTestRequest(request: IPCMessages.TMessage, response: (instance: IPCMessages.TMessage) => any) {
        /*
        const req: IPCMessages.TimestampTestRequest = request as IPCMessages.TimestampTestRequest;
        const controller: MergeFormat = new MergeFormat(req.format);
        controller.validate(req.flags).then((regexp: string) => {
            if (regexp === undefined) {
                response(new IPCMessages.TimestampTestResponse({
                    id: req.id,
                    error: `Fail to generate regexp based on "${req.format}" format string.`,
                }));
            } else {
                response(new IPCMessages.TimestampTestResponse({
                    id: req.id,
                    format: {
                        regex: regexp,
                        flags: [],
                        format: req.format,
                    },
                }));
            }
        }).catch((error: Error) => {
            response(new IPCMessages.TimestampTestResponse({
                id: req.id,
                error: error.message,
            }));
        });
        */
    }

    private _onTimestampExtractRequest(request: IPCMessages.TMessage, response: (instance: IPCMessages.TMessage) => any) {
        /*
        const req: IPCMessages.TimestampExtractRequest = request as IPCMessages.TimestampExtractRequest;
        const controller: TimestampExtract = new TimestampExtract(req.str, req.format);
        controller.extract(req.replacements).then((timestamp: number) => {
            if (timestamp === undefined) {
                response(new IPCMessages.TimestampExtractResponse({
                    id: req.id,
                    error: `Fail to extract timestamp based on "${req.format}" format string.`,
                }));
            } else {
                response(new IPCMessages.TimestampExtractResponse({
                    id: req.id,
                    timestamp: timestamp,
                }));
            }
        }).catch((error: Error) => {
            response(new IPCMessages.TimestampExtractResponse({
                id: req.id,
                error: error.message,
            }));
        });
        */
    }

    private _onTimestampExportCSVRequest(request: IPCMessages.TMessage, response: (instance: IPCMessages.TMessage) => any) {
        /*
        const req: IPCMessages.TimestampExportCSVRequest = request as IPCMessages.TimestampExportCSVRequest;
        dialog.showSaveDialog({
            title: 'Saving filters',
            filters: [{ name: 'CSV Files', extensions: ['csv']}],
        }).then((results: SaveDialogReturnValue) => {
            if (typeof results.filePath !== 'string' || results.filePath.trim() === '') {
                return response(new IPCMessages.TimestampExportCSVResponse({
                    id: req.id,
                }));
            }
            fs.writeFile(results.filePath, req.csv, (error: NodeJS.ErrnoException | null) => {
                if (error) {
                    response(new IPCMessages.TimestampExportCSVResponse({
                        id: req.id,
                        error: error.message,
                    }));
                } else {
                    response(new IPCMessages.TimestampExportCSVResponse({
                        id: req.id,
                    }));
                }
            });
        });
        */
    }
/*
    private _addTask(session: string, taskId: string, controller: MergeDiscover) {
        const storage: Map<string, MergeDiscover> | undefined = this._tasks.get(session);
        if (storage === undefined) {
            this._tasks.set(session, new Map([[taskId, controller]]));
        } else {
            storage.set(taskId, controller);
            this._tasks.set(session, storage);
        }
    }

    private _removeTask(session: string, taskId: string) {
        const storage: Map<string, MergeDiscover> | undefined = this._tasks.get(session);
        if (storage !== undefined) {
            storage.delete(taskId);
            this._tasks.set(session, storage);
        }
    }

    private _onSessionClosed(guid: string) {
        const storage: Map<string, MergeDiscover> | undefined = this._tasks.get(guid);
        if (storage !== undefined) {
            storage.forEach((controller: MergeDiscover, id: string) => {
                controller.abort().then(() => {
                    this._logger.debug(`Task "${id}" is aborted`);
                });
            });
            this._tasks.delete(guid);
        }
    }
*/
}

export default (new ServiceTimestamp());
