import { AFileParser, IFileParserFunc, IMapItem } from "./interface";
import { Transform } from "stream";
import * as path from "path";
import indexer, { Progress, Units } from "indexer-neon";
import ServiceStreams from "../../services/service.streams";
import * as ft from "file-type";
import * as fs from "fs";
import { Subscription } from "../../tools/index";
import Logger from "../../tools/env.logger";
import ServiceNotifications, { ENotificationType } from "../../services/service.notifications";

const ExtNames = ["txt", "log", "logs", "json", "less", "css", "sass", "ts", "js"];

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
        return "text format";
    }

    public getAlias(): string {
        return "text";
    }

    public getExtnameFilters(): Array<{ name: string; extensions: string[] }> {
        return [{ name: "Text files", extensions: ExtNames }];
    }

    public isSupported(file: string): Promise<boolean> {
        return new Promise((resolve, reject) => {
            fs.open(file, "r", (openError: NodeJS.ErrnoException | null, fd: number) => {
                if (openError) {
                    return reject(openError);
                }
                const buffer: Buffer = Buffer.alloc(ft.minimumBytes);
                fs.read(
                    fd,
                    buffer,
                    0,
                    ft.minimumBytes,
                    0,
                    (readError: NodeJS.ErrnoException | null, read: number, buf: Buffer) => {
                        if (readError) {
                            return reject(readError);
                        }
                        const type: ft.FileTypeResult | undefined = ft(buf);
                        if (type === undefined) {
                            const extname: string = path
                                .extname(file)
                                .toLowerCase()
                                .replace(".", "");
                            resolve(ExtNames.indexOf(extname) !== -1);
                        } else if (
                            type.mime.indexOf("text") !== -1 ||
                            type.mime.indexOf("application") !== -1
                        ) {
                            resolve(true);
                        }
                        resolve(false);
                    },
                );
            });
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
        onProgress?: (ticks: Progress.ITicks) => void,
    ): Promise<IMapItem[]> {
        // TODO remove options argument
        this._guid = ServiceStreams.getActiveStreamId();
        let completeTicks: number = 0;
        const onNotification = (notification: Progress.INeonNotification) => {
            ServiceNotifications.notifyFromNeon(notification, "Indexing", this._guid, srcFile);
        };
        return new Promise((resolve, reject) => {
            const collectedChunks: IMapItem[] = [];
            const hrstart = process.hrtime();
            const [futureRes, cancel]: [Promise<Progress.AsyncResult>, () => void] = indexer.indexAsync(
                500,
                srcFile,
                Units.TimeUnit.fromSeconds(15),
                destFile,
                (ticks: Progress.ITicks) => {
                    if (onProgress !== undefined) {
                        completeTicks = ticks.total;
                        onProgress(ticks);
                    }
                },
                (e: Progress.IChunk) => {
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
                sourceId.toString(),
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
        this._logger.debug("text indexing: no cancel function set");
    };
}
