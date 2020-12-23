import Logger from "../../tools/env.logger";

import * as Tools from "../../tools/index";
import * as path from "path";

import { AFileParser, IMapItem } from "./interface";
import { CommonInterfaces } from '../../interfaces/interface.common';
import { IPCMessages } from "../../services/service.electron";
import { CExportSelectionActionId, CExportAllActionId } from '../../consts/output.actions';

import indexer, { DLT, Progress, CancelablePromise } from "indexer-neon";
import ServiceNotifications, { ENotificationType } from "../../services/service.notifications";

import ServiceOutputExport from "../../services/output/service.output.export";
import ServiceStreams from "../../services/service.sessions";
import ServiceDLTDeamonConnector from '../../services/connectors/service.dlt.deamon';

export const CMetaData = 'dlt';

const ExtNames = ["dlt"];

export default class FileParser extends AFileParser {

    private _guid: string | undefined;
    private _logger: Logger = new Logger("DLT Indexing");
    private _task: CancelablePromise<void, void, DLT.TIndexDltAsyncEvents, DLT.TIndexDltAsyncEventObject> | undefined;

    constructor() {
        super();
    }

    public destroy(): Promise<void> {
        return this.abort();
    }

    public getName(): string {
        return "DLT format";
    }

    public getAlias(): string {
        return "dlt";
    }

    public getMeta(): string {
        return CMetaData;
    }

    public getExtnameFilters(): Array<{ name: string; extensions: string[] }> {
        return [{ name: "DLT Files", extensions: ExtNames }];
    }

    public getExtensions(): string[] {
        return ExtNames.slice();
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

    public parseAndIndex(
        srcFile: string,
        destFile: string,
        sourceId: string,
        options: CommonInterfaces.DLT.IDLTOptions,
        onMapUpdated?: (map: IMapItem[]) => void,
        onProgress?: (ticks: Progress.ITicks) => void,
    ): Tools.CancelablePromise<IMapItem[], void> {
        return new Tools.CancelablePromise<IMapItem[], void>((resolve, reject, cancel) => {
            if (this._guid !== undefined) {
                return reject(new Error(`Parsing is already started.`));
            }
            this._guid = ServiceStreams.getActiveStreamId();
            const collectedChunks: IMapItem[] = [];
            const hrstart = process.hrtime();
            let appIds: string[] | undefined;
            let contextIds: string[] | undefined;
            let ecuIds: string[] | undefined;
            if (options.filters !== undefined && options.filters.app_ids instanceof Array) {
                appIds = options.filters.app_ids;
            }
            if (options.filters !== undefined && options.filters.context_ids instanceof Array) {
                contextIds = options.filters.context_ids;
            }
            if (options.filters !== undefined && options.filters.ecu_ids instanceof Array) {
                ecuIds = options.filters.ecu_ids;
            }
            if (typeof options.fibex !== 'object' || options.fibex === null) {
                options.fibex = {
                    fibex_file_paths: [],
                };
            }
            if (!(options.fibex.fibex_file_paths instanceof Array)) {
                options.fibex.fibex_file_paths = [];
            }
            const filterConfig: DLT.DltFilterConf = {
                min_log_level: options.logLevel,
                app_ids: appIds,
                context_ids: contextIds,
                ecu_ids: ecuIds,
            };
            const dltParams: DLT.IIndexDltParams = {
                dltFile: srcFile,
                fibex: options.fibex,
                filterConfig,
                tag: sourceId.toString(),
                out: destFile,
                chunk_size: 500,
                append: false,
                stdout: false,
                statusUpdates: true,
            };
            this._logger.debug("calling indexDltAsync with params: " + JSON.stringify(dltParams));
            this._task = indexer.indexDltAsync(dltParams).then(() => {
                resolve(collectedChunks);
                // Register exports callback
                ServiceOutputExport.setAction(this._guid as string, CExportAllActionId, {
                    caption: 'Export all',
                    handler: this._exportAll.bind(this, srcFile),
                    isEnabled: () => true,
                });
                ServiceOutputExport.setAction(this._guid as string, CExportSelectionActionId, {
                    caption: 'Export selection',
                    handler: this._exportSelection.bind(this, srcFile),
                    isEnabled: () => true,
                });
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
                    onProgress(event);
                }
            }).on('notification', (event: Progress.INeonNotification) => {
                ServiceNotifications.notifyFromNeon(
                    event,
                    "DLT-Indexing",
                    this._guid,
                    srcFile,
                );
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

    private _exportAll(target: string): Promise<void> {
        return new Promise((resolve, reject) => {
            ServiceDLTDeamonConnector.saveAs(target, 'file').then(() => {
                resolve();
            }).catch((saveErr: Error) => {
                this._logger.warn(`Fail to save stream data due error: ${saveErr.message}`);
                reject(saveErr);
            });
        });
    }

    private _exportSelection(target: string, request: IPCMessages.OutputExportFeaturesRequest | IPCMessages.OutputExportFeatureCallRequest): Promise<void> {
        return new Promise((resolve, reject) => {
            const sections: CommonInterfaces.IIndexSection[] = request.selection.map((range) => {
                return { first_line: range.from, last_line: range.to };
            });
            ServiceDLTDeamonConnector.saveAs(target, 'file', sections).then(() => {
                resolve();
            }).catch((saveErr: Error) => {
                this._logger.warn(`Fail to save stream data due error: ${saveErr.message}`);
                reject(saveErr);
            });
        });
    }

}
