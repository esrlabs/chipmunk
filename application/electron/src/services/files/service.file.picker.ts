import ServiceElectron, { IPCMessages } from '../service.electron';
import { dialog, OpenDialogReturnValue, FileFilter } from 'electron';

import Logger from '../../tools/env.logger';
import * as Tools from '../../tools/index';
import * as fs from 'fs';
import * as path from 'path';
import { Subscription } from '../../tools/index';
import { IService } from '../../interfaces/interface.service';

/**
 * @class ServiceFilePicker
 * @description Opens files and returns fullpath
 */

class ServiceFilePicker implements IService {

    private _logger: Logger = new Logger('ServiceFilePicker');
    // Should detect by executable file
    private _subscription: { [key: string]: Subscription } = {};

    /**
     * Initialization function
     * @returns Promise<void>
     */
    public init(): Promise<void> {
        return new Promise((resolve, reject) => {
            ServiceElectron.IPC.subscribe(IPCMessages.FilePickerRequest, this._ipc_FilePickerRequest.bind(this)).then((subscription: Subscription) => {
                this._subscription.FilePickerRequest = subscription;
                resolve();
            }).catch((error: Error) => {
                this._logger.error(`Fail to init module due error: ${error.message}`);
                reject(error);
            });
        });
    }

    public destroy(): Promise<void> {
        return new Promise((resolve) => {
            Object.keys(this._subscription).forEach((key: string) => {
                this._subscription[key].destroy();
            });
            resolve();
        });
    }

    public getName(): string {
        return 'ServiceFilePicker';
    }

    private _ipc_FilePickerRequest(request: IPCMessages.TMessage, response: (instance: IPCMessages.TMessage) => any) {
        const req: IPCMessages.FilePickerRequest = request as IPCMessages.FilePickerRequest;
        this._open(
            req.filter instanceof Array ? req.filter : [],
            typeof req.multiple === 'boolean' ? req.multiple : false,
        ).then((files: string[]) => {
            if (files.length === 0) {
                return response(new IPCMessages.FilePickerResponse({
                    files: [],
                }));
            }
            Promise.all(files.map((file: string) => {
                return this._getInfo(file);
            })).then((data: IPCMessages.IFilePickerFileInfo[]) => {
                response(new IPCMessages.FilePickerResponse({
                    files: data,
                }));
            }).catch((gettingInfoError: Error) => {
                response(new IPCMessages.FilePickerResponse({
                    files: [],
                    error: gettingInfoError.message,
                }));
            });
        }).catch((error: Error) => {
            response(new IPCMessages.FilePickerResponse({
                files: [],
                error: error.message,
            }));
        });
    }

    private _open(filters: FileFilter[] = [], multiple: boolean = false): Promise<string[]> {
        return new Promise((resolve, reject) => {
            const win = ServiceElectron.getBrowserWindow();
            if (win === undefined) {
                return;
            }
            const options: string[] = ['openFile', 'showHiddenFiles'];
            if (multiple) {
                options.push('multiSelections');
            }
            dialog.showOpenDialog(win, {
                properties: options as any[],
                filters: filters,
            }).then((returnValue: OpenDialogReturnValue) => {
                resolve(returnValue.filePaths);
            }).catch((error: Error) => {
                this._logger.error(`Fail open file due error: ${error.message}`);
            });
        });
    }

    private _getInfo(file: string): Promise<IPCMessages.IFilePickerFileInfo> {
        return new Promise((resolve, reject) => {
            fs.stat(file, (error: NodeJS.ErrnoException | null, stats: fs.Stats) => {
                if (error) {
                    return reject(error);
                }
                resolve({
                    name: path.basename(file),
                    path: file,
                    size: stats.size,
                    created: stats.ctimeMs,
                    changed: stats.mtimeMs,
                });
            });
        });
    }

}

export default (new ServiceFilePicker());
