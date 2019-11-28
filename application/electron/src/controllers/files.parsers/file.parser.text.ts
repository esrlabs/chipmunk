import { AFileParser, IMapItem } from "./interface";
import * as path from "path";
import indexer, { CancelablePromise, Processor, Progress } from "indexer-neon";
import ServiceStreams from "../../services/service.streams";
import * as ft from "file-type";
import * as fs from "fs";
import * as Tools from "../../tools/index";
import Logger from "../../tools/env.logger";
import ServiceNotifications, { ENotificationType } from "../../services/service.notifications";

const ExtNames = ["txt", "log", "logs", "json", "less", "css", "sass", "ts", "js"];

export default class FileParser extends AFileParser {

    private _guid: string | undefined;
    private _logger: Logger = new Logger("indexing");
    private _task: CancelablePromise<void, void, Processor.TIndexAsyncEvents, Processor.TIndexAsyncEventObject> | undefined;

    constructor() {
        super();
    }

    public destroy(): Promise<void> {
        return this.abort();
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

    public parseAndIndex(
        srcFile: string,
        destFile: string,
        sourceId: string,
        options: { [key: string]: any },
        onMapUpdated?: (map: IMapItem[]) => void,
        onProgress?: (ticks: Progress.ITicks) => void,
    ): Tools.CancelablePromise<IMapItem[], void> {
        return new Tools.CancelablePromise<IMapItem[], void>((resolve, reject, cancel, self) => {
            this._guid = ServiceStreams.getActiveStreamId();
            let completeTicks: number = 0;
            const collectedChunks: IMapItem[] = [];
            const hrstart = process.hrtime();
            this._task = indexer.indexAsync(
                srcFile,
                destFile,
                sourceId.toString(),
                { chunkSize: 500 },
            ).then(() => {
                if (onProgress !== undefined) {
                    onProgress({
                        ellapsed: completeTicks,
                        total: completeTicks,
                    });
                }
                resolve(collectedChunks);
            }).catch((error: Error) => {
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
            }).canceled(() => {
                cancel();
            }).finally(() => {
                this._task = undefined;
                const hrend = process.hrtime(hrstart);
                const ms = Math.round(hrend[0] * 1000 + hrend[1] / 1000000);
                this._logger.debug("parseAndIndex task finished");
                this._logger.debug("Execution time for indexing : " + ms + "ms");
            }).on('chunk', (event: Progress.IChunk) => {
                if (onMapUpdated !== undefined) {
                    const mapItem: IMapItem = {
                        rows: { from: event.rowsStart, to: event.rowsEnd },
                        bytes: { from: event.bytesStart, to: event.bytesEnd },
                    };
                    onMapUpdated([mapItem]);
                    collectedChunks.push(mapItem);
                }
            }).on('progress', (event: Progress.ITicks) => {
                if (onProgress !== undefined) {
                    completeTicks = event.total;
                    onProgress(event);
                }
            }).on('notification', (event: Progress.INeonNotification) => {
                ServiceNotifications.notifyFromNeon(event, "Indexing", this._guid, srcFile);
            });
        });
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
