// tslint:disable:max-classes-per-file
import * as fs from "fs";
import * as path from "path";
import ServiceStreams from "../../../services/service.streams";
import ServiceStreamSource from "../../../services/service.stream.sources";
import ServiceNotifications from "../../../services/service.notifications";
import * as Tools from "../../../tools/index";
import indexer, { Progress, Units } from "indexer-neon";
import Logger from "../../../tools/env.logger";
import { IMapItem } from "../../../controllers/files.parsers/interface";

export interface IFile {
    file: string;
    year?: number;
    offset: number;
    parser: string;
    format: string;
}

export default class MergeFiles {
    private _logger: Logger = new Logger("MergeFiles");
    private _processedBytes: number = 0;
    private _session: string = "";
    private _files: IFile[];
    private _absolutePathConfig: Progress.IMergerItemOptions[];
    private _sourceIds: { [key: string]: number } = {};
    private _writeSessionsId: string = Tools.guid();
    private _onProgress: (ticks: Progress.ITicks) => void;

    constructor(session: string, files: IFile[], onProgress: (ticks: Progress.ITicks) => void) {
        this._files = files;
        this._session = session === undefined ? ServiceStreams.getActiveStreamId() : session;
        this._onProgress = onProgress;
        this.registerSourceMarkers();
        this._absolutePathConfig = files.map((file: IFile) => {
            return {
                name: file.file,
                offset: file.offset,
                year: file.year,
                format: file.format,
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
                this._logger.debug(`merged chunk: ${JSON.stringify(res)}`);
                if (onMapUpdated !== undefined) {
                    const mapItem: IMapItem = {
                        rows: { from: res.rowsStart, to: res.rowsEnd },
                        bytes: { from: res.bytesStart, to: res.bytesEnd },
                    };
                    onMapUpdated([mapItem]);
                    this._processedBytes = res.bytesEnd;
                }
            };
            const [futureRes, cancel]: [Promise<Progress.AsyncResult>, () => void] = indexer.mergeFilesAsync(
                this._absolutePathConfig,
                sessionData.file,
                true,
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
        ServiceStreams.removeProgressSession(this._writeSessionsId, this._session);
        // Drop all others
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
