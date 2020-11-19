import * as fs from 'fs';

import Logger from '../../tools/env.logger';
import ServiceElectron, { IPCMessages } from '../../services/service.electron';
import ServiceOutputExport from "../../services/output/service.output.export";
import ServiceStreams from "../../services/service.sessions";
import indexer from "indexer-neon";
import { CancelablePromise, Progress, Exporter } from "indexer-neon";
import ServiceFileRecent from '../../services/files/service.file.recent';

import { CommonInterfaces } from '../../interfaces/interface.common';
import { dialog, SaveDialogReturnValue } from 'electron';
import { CExportSelectionActionId, CExportAllActionId } from '../../consts/output.actions';

export class DefaultOutputExport {

    private _logger: Logger;
    private _guid: string;
    private _saver: CancelablePromise<void, void, Exporter.TFileAsyncEvents, Exporter.TFileAsyncEventObject> | undefined;

    constructor(guid: string) {
        this._guid = guid;
        this._logger = new Logger(`DefaultOutputExport: ${this._guid}`);
        // Register exports callback
        ServiceOutputExport.setAction(this._guid, CExportAllActionId, {
            caption: 'Export all',
            handler: this._exportAll.bind(this, this._guid),
            isEnabled: () => true,
        });
        ServiceOutputExport.setAction(this._guid, CExportSelectionActionId, {
            caption: 'Export selection',
            handler: this._exportSelection.bind(this, this._guid),
            isEnabled: () => true,
        });
    }

    public destroy() {
        if (this._saver === undefined) {
            return;
        }
        this._saver.abort();
    }

    private _exportAll(session: string): Promise<void> {
        return new Promise((resolve, reject) => {
            const file = ServiceStreams.getStreamFile(session);
            if (file instanceof Error) {
                return reject(new Error(this._logger.warn(`Fail get stream file for session "${session}" due error: ${file.message}`)));
            }
            this._saveAs(file.file, []).then(() => {
                resolve();
            }).catch((saveErr: Error) => {
                this._logger.warn(`Fail to save stream data due error: ${saveErr.message}`);
                reject(saveErr);
            });
        });
    }
    private _exportSelection(session: string, request: IPCMessages.OutputExportFeaturesRequest | IPCMessages.OutputExportFeatureCallRequest): Promise<void> {
        return new Promise((resolve, reject) => {
            const sections: CommonInterfaces.IIndexSection[] = request.selection.map((range) => {
                return { first_line: range.from, last_line: range.to };
            });
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
        });
    }

    private _saveAs(sessionFile: string, sections: CommonInterfaces.IIndexSection[] = []): Promise<string | undefined> {
        return new Promise((resolve, reject) => {
            this._getFileName().then((filename: string | undefined) => {
                if (filename === undefined) {
                    return resolve(undefined);
                }
                this._logger.info(`Saving`);
                this._saver = indexer.exportLineBased(sessionFile, filename, true, { sections: sections }).then(() => {
                    fs.stat(filename, (error: NodeJS.ErrnoException | null, stats: fs.Stats) => {
                        if (error) {
                            return reject(error);
                        }
                        ServiceFileRecent.save(filename, stats.size);
                    });
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
