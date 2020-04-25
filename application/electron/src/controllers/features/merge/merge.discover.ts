// tslint:disable:max-classes-per-file
import { CancelablePromise, Processor, Progress, Units } from "indexer-neon";
import { Subscription } from "../../../tools/index";
import { PCREToECMARegExp, isRegStrValid } from '../../../tools/tools.regexp';
import { IPCMessages } from '../../../services/service.electron';

import Logger from "../../../tools/env.logger";
import ServiceNotifications from "../../../services/service.notifications";
import indexer from "indexer-neon";
import ServiceStreams from "../../../services/service.streams";

export interface IDatetimeDiscoverResult {
    files: IPCMessages.IMergeFilesDiscoverResult[];
    logs?: ILogMessage[];
}

export interface ILogMessage {
    severity: string;
    text: string;
    line_nr: number | null;
    file_name?: string;
}

export interface IFile {
    file: string;
    format?: string;
    year?: number;
}

export default class MergeDiscover {
    private _subscriptions: { [key: string]: Subscription } = {};
    private _logger: Logger = new Logger("MergeDiscover");
    private _closed: boolean = false;
    private _session: string = "";
    private _files: IFile[];
    private _task: CancelablePromise<void, void, Processor.TDiscoverTimespanAsyncEvents, Processor.TDiscoverTimespanAsyncEventObject> | undefined;

    constructor(files: IFile[], session?: string) {
        this._files = files;
        this._session = session === undefined ? ServiceStreams.getActiveStreamId() : session;
    }

    public discover(onProgress?: (ticks: Progress.ITicks) => void): Promise<IPCMessages.IMergeFilesDiscoverResult[]> {
        const results: IPCMessages.IMergeFilesDiscoverResult[] = [];
        return new Promise((resolve, reject) => {
            // Remember active session
            let completeTicks: number = 0;
            const hrstart = process.hrtime();
            const discoverItems: Progress.IDiscoverItem[] = this._files.map((file: IFile) => {
                return { path: file.file, format_string: file.format };
            });
            this._task = indexer.discoverTimespanAsync(discoverItems).then(() => {
                if (onProgress !== undefined) {
                    onProgress({
                        ellapsed: completeTicks,
                        total: completeTicks,
                    });
                }
                const hrend = process.hrtime(hrstart);
                const ms = Math.round(hrend[0] * 1000 + hrend[1] / 1000000);
                this._logger.debug("parseAndIndex task finished");
                this._logger.debug("Execution time for indexing : " + ms + "ms");
                resolve(results);
            }).catch((error: Error) => {
                if (this._closed) {
                    return resolve([]);
                }
                ServiceNotifications.notify({
                    message:
                        error.message.length > 1500
                            ? `${error.message.substr(0, 1500)}...`
                            : error.message,
                    caption: "Error with discovery",
                    session: this._session,
                    type: "Error",
                });
                reject(error);
            }).finally(() => {
                this._task = undefined;
            }).on('chunk', (event: Progress.ITimestampFormatResult) => {
                if (event.format !== undefined && event.format.Ok !== undefined) {
                    event.format.Ok.regex = PCREToECMARegExp(event.format.Ok.regex);
                    if (!isRegStrValid(event.format.Ok.regex)) {
                        event.format = {
                            Err: `Fail convert "${event.format.Ok.regex}" from PCRE to ECMA regexp.`,
                        };
                    }
                }
                const r: IPCMessages.IMergeFilesDiscoverResult = {
                    format: event.format === undefined ? undefined : (event.format.Ok === undefined ? undefined : {
                        regex: event.format.Ok.regex,
                        flags: event.format.Ok.flags,
                        format: event.format.Ok.format,
                    }),
                    minTime: event.min_time,
                    maxTime: event.max_time,
                    path: event.path,
                    error: event.format?.Err,
                };
                results.push(r);
            }).on('progress', (event: Progress.ITicks) => {
                if (onProgress !== undefined) {
                    completeTicks = event.total;
                    onProgress(event);
                }
            }).on('notification', (event: Progress.INeonNotification) => {
                ServiceNotifications.notifyFromNeon(
                    event,
                    "discover timestamps",
                    this._session,
                );
            });
        });
    }

    public destroy(): Promise<void> {
        return this.abort();
    }

    public abort(): Promise<void> {
        return new Promise((resolve) => {
            if (this._task === undefined) {
                return resolve();
            }
            this._task.canceled(() => {
                resolve();
            }).abort();
        });
    }
}
