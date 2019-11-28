// tslint:disable:max-classes-per-file
import * as fs from "fs";
import * as path from "path";
import ServiceStreams from "../../../services/service.streams";
import ServiceStreamSource from "../../../services/service.stream.sources";
import ServiceNotifications from "../../../services/service.notifications";
import * as Tools from "../../../tools/index";
import indexer, { CancelablePromise, Progress, Units, Merge } from "indexer-neon";
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
    private _task: CancelablePromise<void, void, Merge.TMergeFilesEvents, Merge.TMergeFilesEventObject> | undefined;

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

    public write(onMapUpdated: (map: IMapItem[]) => void): Tools.CancelablePromise<number, void> {
        return new Tools.CancelablePromise<number, void>((resolve, reject, cancel, self) => {
            const measuring = this._logger.measure("concatenate");
            const sessionData = ServiceStreams.getStreamFile(this._session);
            if (sessionData instanceof Error) {
                measuring();
                return reject(sessionData);
            }
            this._task = indexer.mergeFilesAsync(
                this._absolutePathConfig,
                sessionData.file,
                { append: true, maxTime: Units.TimeUnit.fromSeconds(2) },
            ).then(() => {
                resolve(this._processedBytes);
            }).catch(e => {
                reject(e);
            }).finally(() => {
                this._task = undefined;
                measuring();
            }).canceled(() => {
                cancel();
            }).on('notification', (event: Progress.INeonNotification) => {
                ServiceNotifications.notifyFromNeon(event, "DLT-Indexing", this._session);
            }).on('progress', (event: Progress.ITicks) => {
                this._onProgress(event);
            }).on('result', (event: Progress.IChunk) => {
                this._logger.debug(`merged chunk: ${JSON.stringify(event)}`);
                if (onMapUpdated !== undefined) {
                    const mapItem: IMapItem = {
                        rows: { from: event.rowsStart, to: event.rowsEnd },
                        bytes: { from: event.bytesStart, to: event.bytesEnd },
                    };
                    onMapUpdated([mapItem]);
                    this._processedBytes = event.bytesEnd;
                }
            });
        });
    }

    public destroy() {
        ServiceStreams.removeProgressSession(this._writeSessionsId, this._session);
        // Drop all others
        this._sourceIds = {};
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

    private registerSourceMarkers() {
        this._files.forEach((file: IFile) => {
            this._sourceIds[file.file] = ServiceStreamSource.add({
                name: path.basename(file.file),
                session: this._session,
            });
        });
    }

}
