import { AFileParser, IFileParserFunc, IMapItem } from "./interface";
import { Transform } from "stream";
import * as path from "path";
import {
    indexer,
    ITicks,
    DltFilterConf,
    TimeUnit,
    INeonTransferChunk,
    INeonNotification,
    AsyncResult,
    IIndexDltParams,
    IChunk,
} from "indexer-neon";
import ServiceStreams from "../../services/service.streams";
import { Subscription } from "../../tools/index";
import Logger from "../../tools/env.logger";
import ServiceNotifications, { ENotificationType } from "../../services/service.notifications";

const ExtNames = ["dlt"];

export default class FileParser extends AFileParser {
    private _subscriptions: { [key: string]: Subscription } = {};
    private _guid: string | undefined;
    private _closed: boolean = false;
    private _logger: Logger = new Logger("indexing");
    private _cancel: () => void;

    constructor() {
        super();
        this._subscriptions.onSessionClosed = ServiceStreams.getSubjects().onSessionClosed.subscribe(
            this._onSessionClosed.bind(this),
        );
        this._cancel = this._defaultCancel;
    }

    public destroy() {
        Object.keys(this._subscriptions).forEach((key: string) => {
            (this._subscriptions as any)[key].destroy();
        });
    }

    public getName(): string {
        return "DLT format";
    }

    public getAlias(): string {
        return "dlt";
    }

    public getExtnameFilters(): Array<{ name: string; extensions: string[] }> {
        return [{ name: "DLT Files", extensions: ExtNames }];
    }

    public isSupported(file: string): Promise<boolean> {
        return new Promise((resolve, reject) => {
            const extname: string = path
                .extname(file)
                .toLowerCase()
                .replace(".", "");
            resolve(ExtNames.indexOf(extname) !== -1);
        });
    }

    public getTransform(): Transform | undefined {
        // Do not need any transform operations
        return undefined;
    }

    public getParserFunc(): IFileParserFunc {
        return {
            parse: (chunk: Buffer) => {
                return new Promise(resolve => {
                    resolve(chunk);
                });
            },
            close: () => {
                // Do nothing
            },
            rest: () => {
                // Do nothing
                return "";
            },
        };
    }

    public isTicksSupported(): boolean {
        return true;
    }

    public parseAndIndex(
        srcFile: string,
        destFile: string,
        sourceId: string,
        options: { [key: string]: any },
        onMapUpdated?: (map: IMapItem[]) => void,
        onProgress?: (ticks: ITicks) => void,
    ): Promise<IMapItem[]> {
        return new Promise((resolve, reject) => {
            if (this._guid !== undefined) {
                return reject(new Error(`Parsing is already started.`));
            }
            this._guid = ServiceStreams.getActiveStreamId();
            const collectedChunks: IMapItem[] = [];
            const hrstart = process.hrtime();
            let appIds: String[] | undefined;
            let contextIds: String[] | undefined;
            let ecuIds: String[] | undefined;
            if (options.filters !== undefined && options.filters.app_ids instanceof Array) {
                appIds = options.filters.app_ids;
            }
            if (options.filters !== undefined && options.filters.context_ids instanceof Array) {
                contextIds = options.filters.context_ids;
            }
            if (options.filters !== undefined && options.filters.ecu_ids instanceof Array) {
                ecuIds = options.filters.ecu_ids;
            }
            const filterConfig: DltFilterConf = {
                min_log_level: options.logLevel,
                app_ids: appIds,
                context_ids: contextIds,
                ecu_ids: ecuIds,
            };
            const dltParams: IIndexDltParams = {
                dltFile: srcFile,
                filterConfig,
                tag: sourceId.toString(),
                out: destFile,
                chunk_size: 500,
                append: false,
                stdout: false,
                statusUpdates: true,
            };
            this._logger.debug("calling indexDltAsync with params: " + JSON.stringify(dltParams));
            let completeTicks: number = 0;
            const onNotification = (notification: INeonNotification) => {
                ServiceNotifications.notifyFromNeon(
                    notification,
                    "DLT-Indexing",
                    this._guid,
                    srcFile,
                );
            };
            const [futureRes, cancel]: [Promise<AsyncResult>, () => void] = indexer.indexDltAsync(
                dltParams,
                TimeUnit.fromSeconds(60),
                (ticks: ITicks) => {
                    if (onProgress !== undefined) {
                        completeTicks = ticks.total;
                        onProgress(ticks);
                    }
                },
                (e: IChunk) => {
                    if (onMapUpdated !== undefined) {
                        const mapItem: IMapItem = {
                            rows: { from: e.rowsStart, to: e.rowsEnd },
                            bytes: { from: e.bytesStart, to: e.bytesEnd },
                        };
                        onMapUpdated([mapItem]);
                        collectedChunks.push(mapItem);
                    }
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
                    resolve(collectedChunks);
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
                        caption: `Error with: ${path.basename(srcFile)}`,
                        session: this._guid,
                        file: sourceId.toString(),
                        type: ENotificationType.error,
                    });
                    reject(error);
                });
        });
    }

    private _onSessionClosed(guid: string) {
        if (this._guid !== guid) {
            return;
        }
        this._closed = true;
    }

    private _defaultCancel = () => {
        this._logger.debug("no cancel function set");
    };
}
