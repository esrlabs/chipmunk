// tslint:disable:max-classes-per-file
import * as fs from "fs";
import * as path from "path";
import ServiceStreams from "../../../services/service.streams";
import ServiceStreamSource from "../../../services/service.stream.sources";
import ServiceNotifications from "../../../services/service.notifications";
import indexer, { Progress, Merge, Units } from "indexer-neon";
import Logger from "../../../tools/env.logger";
import { IMapItem } from "../../../controllers/stream.main/file.map";

export interface IFile {
    file: string;
    parser: string;
}

export default class ConcatFiles {
    private _logger: Logger = new Logger("ConcatFiles");
    private _processedBytes: number = 0;
    private _session: string = "";
    private _files: IFile[];
    private _absolutePathConfig: Merge.ConcatenatorInput[];
    private _sourceIds: { [key: string]: number } = {};
    private _onProgress: (ticks: Progress.ITicks) => void;

    constructor(session: string, files: IFile[], onProgress: (ticks: Progress.ITicks) => void) {
        this._files = files;
        this._session = session === undefined ? ServiceStreams.getActiveStreamId() : session;
        this._onProgress = onProgress;
        this.registerSourceMarkers();
        this._absolutePathConfig = files.map((file: IFile) => {
            return {
                path: file.file,
                tag: this._sourceIds[file.file].toString(),
            };
        });
    }

    public write(onMapUpdated: (map: IMapItem[]) => void): Promise<number> {
        return new Promise((resolve, reject) => {
            const measuring = this._logger.measure("concatenate");
            const sessionData = ServiceStreams.getStreamFile(this._session);
            if (sessionData instanceof Error) {
                measuring();
                return reject(sessionData);
            }
            const onNotification = (notification: Progress.INeonNotification) => {
                ServiceNotifications.notifyFromNeon(notification, "DLT-Indexing", this._session);
            };
            const onResult = (res: Progress.IChunk) => {
                if (onMapUpdated !== undefined) {
                    const mapItem: IMapItem = {
                        rows: { from: res.rowsStart, to: res.rowsEnd },
                        bytes: { from: res.bytesStart, to: res.bytesEnd },
                    };
                    onMapUpdated([mapItem]);
                    this._processedBytes = res.bytesEnd;
                }
            };
            const [futureRes, cancel]: [
                Promise<Progress.AsyncResult>,
                () => void,
            ] = indexer.concatFilesAsync(
                this._absolutePathConfig,
                sessionData.file,
                true,
                500, // chunkSize
                Units.TimeUnit.fromSeconds(2),
                this._onProgress,
                onResult,
                onNotification,
            );
            futureRes
            .then(() => {
                measuring();
                resolve(this._processedBytes);
            })
            .catch(e => {
                measuring();
                reject(e);
            });
        });
    }

    public destroy() {
        this._sourceIds = {};
    }

    private registerSourceMarkers() {
        this._files.forEach((file: IFile) => {
            this._sourceIds[file.file] = ServiceStreamSource.add({
                name: path.basename(file.file),
                session: this._session,
            });
        });
    }

    private _getSize(): Promise<number> {
        return new Promise((resolve, reject) => {
            let size: number = 0;
            Promise.all(
                this._files.map((file: IFile) => {
                    return new Promise((resolveFile, rejectFile) => {
                        fs.stat(
                            file.file,
                            (error: NodeJS.ErrnoException | null, stats: fs.Stats) => {
                                if (error !== null) {
                                    return rejectFile(error);
                                }
                                size += stats.size;
                                resolveFile();
                            },
                        );
                    });
                }),
            )
                .then(() => {
                    resolve(size);
                })
                .catch(error => {
                    reject(error);
                });
        });
    }
}
