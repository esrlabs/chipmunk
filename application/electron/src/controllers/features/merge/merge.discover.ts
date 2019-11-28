// tslint:disable:max-classes-per-file
import ServiceStreams from "../../../services/service.streams";
import {
    IDatetimeDiscoverResult,
    IDatetimeDiscoverFileResult,
} from "../../external/controller.lvin";
import indexer, { CancelablePromise, Processor, Progress, Units } from "indexer-neon";
import Logger from "../../../tools/env.logger";
import ServiceNotifications from "../../../services/service.notifications";
import { IDiscoverItem } from "../../../../../apps/indexer-neon/dist/progress";
import { Subscription } from "../../../tools/index";

export { IDatetimeDiscoverResult };

export default class MergeDiscover {
    private _subscriptions: { [key: string]: Subscription } = {};
    private _logger: Logger = new Logger("MergeDiscover");
    private _closed: boolean = false;
    private _session: string = "";
    private _files: string[];
    private _task: CancelablePromise<void, void, Processor.TDiscoverTimespanAsyncEvents, Processor.TDiscoverTimespanAsyncEventObject> | undefined;

    constructor(files: string[], session?: string) {
        this._files = files;
        this._session = session === undefined ? ServiceStreams.getActiveStreamId() : session;
        /*
        this._subscriptions.onSessionClosed = ServiceStreams.getSubjects().onSessionClosed.subscribe(
            this._onSessionClosed.bind(this),
        );
        */
    }

    public discover(onProgress?: (ticks: Progress.ITicks) => void): Promise<IDatetimeDiscoverFileResult[]> {
        const results: IDatetimeDiscoverFileResult[] = [];
        return new Promise((resolve, reject) => {
            // Remember active session
            let completeTicks: number = 0;
            const hrstart = process.hrtime();
            const discoverItems: IDiscoverItem[] = this._files.map((file: string) => {
                return { path: file };
            });
            this._task = indexer.discoverTimespanAsync(discoverItems, { maxTime: Units.TimeUnit.fromSeconds(15) }).then(() => {
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
                let format = "";
                if (event.format !== undefined) {
                    format = event.format;
                }
                const r: IDatetimeDiscoverFileResult = {
                    format,
                    path: event.path,
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
