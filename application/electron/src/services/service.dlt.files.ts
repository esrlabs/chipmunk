import ServiceElectron, { IPCMessages } from './service.electron';
import Logger from '../tools/env.logger';
import { Subscription } from '../tools/index';
import { IService } from '../interfaces/interface.service';
import { Lvin, IDLTStatsResults, IDLTLogMessage } from 'logviewer.lvin';
import * as path from 'path';

/**
 * @class ServiceDLTFiles
 * @description Providers access to merge files functionality from render
 */

class ServiceDLTFiles implements IService {

    private _logger: Logger = new Logger('ServiceDLTFiles');
    // Should detect by executable file
    private _subscription: { [key: string]: Subscription } = {};

    /**
     * Initialization function
     * @returns Promise<void>
     */
    public init(): Promise<void> {
        return new Promise((resolve, reject) => {
            ServiceElectron.IPC.subscribe(IPCMessages.DLTStatsRequest, this._onDLTStatsRequest.bind(this)).then((subscription: Subscription) => {
                this._subscription.MergeFilesRequest = subscription;
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
        return 'ServiceDLTFiles';
    }

    private _onDLTStatsRequest(request: IPCMessages.TMessage, response: (instance: IPCMessages.TMessage) => any) {
        const req: IPCMessages.DLTStatsRequest = request as IPCMessages.DLTStatsRequest;
        const lvin: Lvin = new Lvin();
        lvin.dltStat({ srcFile: req.file }).then((results: IDLTStatsResults) => {
            if (results.logs instanceof Array) {
                results.logs.forEach((log: IDLTLogMessage) => {
                    ServiceElectron.IPC.send(new IPCMessages.Notification({
                        type: log.severity,
                        message: `${log.line_nr !== null ? `[line: ${log.line_nr}]: ` : ''}${log.text}`,
                        caption: path.basename(req.file),
                    }));
                });
            }
            response(new IPCMessages.DLTStatsResponse({
                stats: results.stats,
                id: req.id,
                session: req.session,
                logs: results.logs,
            }));
        }).catch((error: Error) => {
            response(new IPCMessages.DLTStatsResponse({
                stats: undefined,
                id: req.id,
                session: req.session,
                error: error.message,
            }));
        });
    }

}

export default (new ServiceDLTFiles());
