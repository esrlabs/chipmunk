// tslint:disable:max-classes-per-file
import * as fs from "fs";
import * as path from "path";
import ServiceStreams from "../../../services/service.streams";
import ServiceStreamSource from "../../../services/service.stream.sources";
import ServiceNotifications from "../../../services/service.notifications";
import {
    indexer,
    ITicks,
    TimeUnit,
    AsyncResult,
    ConcatenatorInput,
    INeonNotification,
} from "indexer-neon";
import Logger from "../../../tools/env.logger";
import { IMapItem } from "../../../controllers/stream.main/file.map";
import { IConcatenatorResult } from "indexer-neon/dist/progress";

export interface IFile {
    file: string;
    parser: string;
}

export default class ConcatFiles {
    private _logger: Logger = new Logger("ConcatFiles");
    private _res?: IConcatenatorResult;
    private _session: string = "";
    private _files: IFile[];
    private _absolutePathConfig: ConcatenatorInput[];
    private _sourceIds: { [key: string]: number } = {};
    private _onProgress: (ticks: ITicks) => void;

    constructor(session: string, files: IFile[], onProgress: (ticks: ITicks) => void) {
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

    public write(): Promise<IConcatenatorResult> {
        return new Promise((resolve, reject) => {
            const measuring = this._logger.measure("concatenate");
            const sessionData = ServiceStreams.getStreamFile(this._session);
            if (sessionData instanceof Error) {
                measuring();
                return reject(sessionData);
            }
            const onNotification = (notification: INeonNotification) => {
                ServiceNotifications.notifyFromNeon(notification, "DLT-Indexing", this._session);
            };
            const onResult = (res: IConcatenatorResult) => {
                this._logger.debug(`conatenated ${res} files`);
                this._res = res;
            };
            const [futureRes, cancel]: [
                Promise<AsyncResult>,
                () => void,
            ] = indexer.concatFilesAsync(
                this._absolutePathConfig,
                sessionData.file,
                true,
                TimeUnit.fromSeconds(2),
                this._onProgress,
                onResult,
                onNotification,
            );
            futureRes
            .then(() => {
                measuring();
                if (this._res !== undefined) {
                    const lastLineIndex = this._res.line_cnt === 0 ? 0 : this._res.line_cnt - 1;
                    const lastByteIndex = this._res.byte_cnt === 0 ? 0 : this._res.byte_cnt - 1;
                    const map: IMapItem[] = [{ rows: { from: 0, to: lastLineIndex}, bytes: { from: 0, to: lastByteIndex} }];
                    ServiceStreams.pushToStreamFileMap(this._session, map);
                }
                resolve(this._res);
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
