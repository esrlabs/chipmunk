import * as FS from '../tools/fs';
import * as path from 'path';
import * as tar from 'tar';

import Logger from '../tools/env.logger';
import ServiceElectron from './service.electron';
import ServicePaths from './service.paths';

import { IService } from '../interfaces/interface.service';
import { IPCMessages, Subscription } from './service.electron';
import { dialog, SaveDialogReturnValue } from 'electron';

const CLogsFiles = [
    'chipmunk.log',
    'chipmunk.indexer.log',
    'chipmunk.launcher.log',
    'chipmunk.updater.log',
];

/**
 * @class ServiceLogsExtractor
 * @description Extracts chipmunk's logs
 */

class ServiceLogsExtractor implements IService {

    private _logger: Logger = new Logger('ServiceLogsExtractor');
    private _subscriptions: { [key: string ]: Subscription } = { };

    /**
     * Initialization function
     * @returns Promise<void>
     */
    public init(): Promise<void> {
        return new Promise((resolve, reject) => {
            ServiceElectron.IPC.subscribe(IPCMessages.ChipmunkLogsRequest, this._ipc_onChipmunkLogsRequest.bind(this)).then((subscription: Subscription) => {
                this._subscriptions.ChipmunkLogsRequest = subscription;
                resolve();
            }).catch((error: Error) => {
                this._logger.warn(`Fail to subscribe to render event "ChipmunkLogsRequest" due error: ${error.message}. This is not blocked error, loading will be continued.`);
                resolve();
            });
        });
    }

    public destroy(): Promise<void> {
        return new Promise((resolve) => {
            Object.keys(this._subscriptions).forEach((key: string) => {
                this._subscriptions[key].destroy();
            });
            resolve();
        });
    }

    public getName(): string {
        return 'ServiceLogsExtractor';
    }

    private _ipc_onChipmunkLogsRequest(req: IPCMessages.TMessage, response: (instance: IPCMessages.TMessage) => any) {
        const request: IPCMessages.ChipmunkLogsRequest = req as IPCMessages.ChipmunkLogsRequest;
        this._getFileName().then((filename: string | undefined) => {
            if (filename === undefined) {
                return response(new IPCMessages.ChipmunkLogsResponse({}));
            }
            const targets: string[] = [];
            Promise.all(CLogsFiles.map((file: string) => {
                const fullfilename: string = path.resolve(ServicePaths.getHome(), file);
                return FS.exist(fullfilename).then((exist: boolean) => {
                    if (exist) {
                        targets.push(file);
                    }
                }).catch((err: Error) => {
                    this._logger.warn(`Fail check file ${fullfilename} due error: ${err.message}`);
                });
            })).then(() => {
                if (targets.length === 0) {
                    return response(new IPCMessages.ChipmunkLogsResponse({
                        error: `No any chipmunk's logs are found`,
                    }));
                }
                tar.c({
                    gzip: true,
                    file: filename,
                    cwd: ServicePaths.getHome(),
                }, targets).then(() => {
                    response(new IPCMessages.ChipmunkLogsResponse({}));
                }).catch((compressErr: Error) => {
                    this._logger.warn(`Fail to compress logs files due error: ${compressErr.message}`);
                    return response(new IPCMessages.ChipmunkLogsResponse({
                        error: `Fail to compress logs files due error: ${compressErr.message}`,
                    }));
                });
            }).catch((checkErr: Error) => {
                this._logger.error(`Fail to check log files due error: ${checkErr.message}`);
                response(new IPCMessages.ChipmunkLogsResponse({
                    error: checkErr.message,
                }));
            });
        }).catch((error: Error) => {
            this._logger.error(`Fail get target file name due error: ${error.message}`);
            response(new IPCMessages.ChipmunkLogsResponse({
                error: error.message,
            }));
        });
    }

    private _getFileName(): Promise<string | undefined> {
        return new Promise((resolve, reject) => {
            const win = ServiceElectron.getBrowserWindow();
            if (win === undefined) {
                return;
            }
            dialog.showSaveDialog(win, {
                title: 'Saving chipmunk\'s logs',
                filters: [{
                    name: 'Tar file',
                    extensions: ['tgz'],
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

export default (new ServiceLogsExtractor());
