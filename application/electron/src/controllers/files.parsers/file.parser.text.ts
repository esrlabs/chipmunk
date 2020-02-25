import { AFileParser, IMapItem } from "./interface";
import { CommonInterfaces } from '../../interfaces/interface.common';
import { dialog, SaveDialogReturnValue } from 'electron';

import * as path from "path";
import * as ft from "file-type";
import * as fs from "fs";
import * as Tools from "../../tools/index";

import indexer, { CancelablePromise, Processor, Progress } from "indexer-neon";
import ServiceNotifications, { ENotificationType } from "../../services/service.notifications";
import ServiceElectron, { IPCMessages } from "../../services/service.electron";

import ServiceStreams from "../../services/service.streams";
import Logger from "../../tools/env.logger";
import ServiceOutputExport from "../../services/output/service.output.export";

const ExtNames = ["txt", "log", "logs", "json", "less", "css", "sass", "ts", "js"];

const CExportSelectionActionId = Tools.guid();

export default class FileParser extends AFileParser {

    private _guid: string | undefined;
    private _logger: Logger = new Logger("Plain Text Indexing");
    private _task: CancelablePromise<void, void, Processor.TIndexAsyncEvents, Processor.TIndexAsyncEventObject> | undefined;
    private _saver: CancelablePromise<void, void, Processor.TFileAsyncEvents, Processor.TFileAsyncEventObject> | undefined;

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

    public getMeta(): string {
        return 'plain/text';
    }

    public getExtnameFilters(): Array<{ name: string; extensions: string[] }> {
        return [{ name: "Text files", extensions: ExtNames }];
    }

    public getExtensions(): string[] {
        return ExtNames.slice();
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
                // Register exports callback
                ServiceOutputExport.setAction(this._guid as string, CExportSelectionActionId, {
                    caption: 'Export selection to text file',
                    // handler: this._exportSelection.bind(this, this._guid as string),
                    handler: this._exportSelection.bind(this, srcFile),
                    isEnabled: () => true,
                });
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

    private _exportSelection(session: string, request: IPCMessages.OutputExportFeaturesRequest | IPCMessages.OutputExportFeatureCallRequest): Promise<void> {
        return new Promise((resolve, reject) => {
            const sections: CommonInterfaces.IIndexSection[] = request.selection.map((range) => {
                return { first_line: range.from, last_line: range.to };
            });
            /*
            const file = ServiceStreams.getStreamFile(session);
            if (file instanceof Error) {
                return reject(new Error(this._logger.warn(`Fail get stream file for session "${session}" due error: ${file.message}`)));
            }
            this._saveAs(file.file, sections).then(() => {
                resolve();
            }).catch((saveErr: Error) => {
                this._logger.warn(`Fail to save stream data due error: ${saveErr.message}`);
                reject(saveErr);
            });
            */
            this._saveAs(session, sections).then(() => {
                resolve();
            }).catch((saveErr: Error) => {
                this._logger.warn(`Fail to save stream data due error: ${saveErr.message}`);
                reject(saveErr);
            });
        });
    }

    private _saveAs(sessionFile: string, sections: CommonInterfaces.IIndexSection[] = []): Promise<string | undefined> {
        return new Promise((resolve, reject) => {
            this._getFileName().then((filename: string | undefined) => {
                if (filename === undefined) {
                    return resolve(undefined);
                }
                this._logger.info(`Saving`);
                this._saver = indexer.exportLineBased(sessionFile, filename, /* true */ false, { sections: sections }).then(() => {
                    this._logger.info(`Saved`);
                    // Resolving
                    resolve(filename);
                }).canceled(() => {
                    this._logger.info(`Saving was canceled`);
                }).catch((error: Error) => {
                    this._logger.warn(`Exception during saving: ${error.message}`);
                    reject(error);
                }).finally(() => {
                    this._saver = undefined;
                }).on('progress', (event: Progress.ITicks) => {
                    // TODO: Do we need this event at all?
                });
            }).catch((error: Error) => {
                reject(error);
            });
        });
    }

    private _getFileName(): Promise<string | undefined> {
        return new Promise((resolve, reject) => {
            const win = ServiceElectron.getBrowserWindow();
            if (win === undefined) {
                return;
            }
            dialog.showSaveDialog(win, {
                title: 'Saving plain-text file',
                filters: [{
                    name: 'Text Files',
                    extensions: ['txt'],
                }],
            }).then((returnValue: SaveDialogReturnValue) => {
                resolve(returnValue.filePath);
            }).catch((error: Error) => {
                this._logger.error(`Fail get filename for saving due error: ${error.message}`);
                reject(error);
            });
        });
    }

}
