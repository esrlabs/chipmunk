// tslint:disable:max-classes-per-file
import ServiceStreams from "../../../services/service.streams";
import {
    IDatetimeDiscoverResult,
    IDatetimeDiscoverFileResult,
} from "../../external/controller.lvin";
import indexer, { Progress, Units } from "indexer-neon";
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
    private _cancel: () => void;

    constructor(files: string[], session?: string) {
        this._files = files;
        this._session = session === undefined ? ServiceStreams.getActiveStreamId() : session;
        this._cancel = this._defaultCancel;
        this._subscriptions.onSessionClosed = ServiceStreams.getSubjects().onSessionClosed.subscribe(
            this._onSessionClosed.bind(this),
        );
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
            const onNotification = (notification: Progress.INeonNotification) => {
                ServiceNotifications.notifyFromNeon(
                    notification,
                    "discover timestamps",
                    this._session,
                );
            };
            const [futureRes, cancel]: [
                Promise<Progress.AsyncResult>,
                () => void,
            ] = indexer.discoverTimespanAsync(
                discoverItems,
                Units.TimeUnit.fromSeconds(15),
                (ticks: Progress.ITicks) => {
                    if (onProgress !== undefined) {
                        completeTicks = ticks.total;
                        onProgress(ticks);
                    }
                },

                (res: Progress.ITimestampFormatResult) => {
                    let format = "";
                    if (res.format !== undefined) {
                        format = res.format;
                    }
                    const r: IDatetimeDiscoverFileResult = {
                        format,
                        path: res.path,
                    };
                    results.push(r);
                },
                onNotification,
            );
            this._cancel = cancel;
            futureRes
                .then(x => {
                    if (onProgress !== undefined) {
                        onProgress({
                            ellapsed: completeTicks,
                            total: completeTicks,
                        });
                    }
                    const hrend = process.hrtime(hrstart);
                    const ms = Math.round(hrend[0] * 1000 + hrend[1] / 1000000);
                    this._logger.debug("parseAndIndex task finished, result: " + x);
                    this._logger.debug("Execution time for indexing : " + ms + "ms");
                    this._cancel = this._defaultCancel;
                    resolve(results);
                })
                .catch((error: Error) => {
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
                });
        });
    }

    public destroy() {
        // Nothing to do
    }

    private _defaultCancel = () => {
        this._logger.debug("discover: no cancel function set");
    };

    private _onSessionClosed(guid: string) {
        if (this._session !== guid) {
            return;
        }
        this._closed = true;
    }
}
