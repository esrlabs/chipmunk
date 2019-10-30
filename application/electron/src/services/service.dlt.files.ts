import ServiceElectron, { IPCMessages } from "./service.electron";
import Logger from "../tools/env.logger";
import { Subscription } from "../tools/index";
import { IService } from "../interfaces/interface.service";
import { indexer, ITicks, TimeUnit, StatisticInfo } from "indexer-neon";
import * as path from "path";
import { AsyncResult } from "../../../apps/indexer-neon/dist/progress";

/**
 * @class ServiceDLTFiles
 * @description Providers access to merge files functionality from render
 */

class ServiceDLTFiles implements IService {
    private _logger: Logger = new Logger("ServiceDLTFiles");
    // Should detect by executable file
    private _subscription: { [key: string]: Subscription } = {};

    /**
     * Initialization function
     * @returns Promise<void>
     */
    public init(): Promise<void> {
        return new Promise((resolve, reject) => {
            ServiceElectron.IPC.subscribe(
                IPCMessages.DLTStatsRequest,
                this._onDLTStatsRequest.bind(this),
            )
                .then((subscription: Subscription) => {
                    this._subscription.MergeFilesRequest = subscription;
                    resolve();
                })
                .catch((error: Error) => {
                    this._logger.error(`Fail to init module due error: ${error.message}`);
                    reject(error);
                });
        });
    }

    public destroy(): Promise<void> {
        return new Promise(resolve => {
            Object.keys(this._subscription).forEach((key: string) => {
                this._subscription[key].destroy();
            });
            resolve();
        });
    }

    public getName(): string {
        return "ServiceDLTFiles";
    }

    private _onDLTStatsRequest(
        request: IPCMessages.TMessage,
        response: (instance: IPCMessages.TMessage) => any,
    ) {
        const req: IPCMessages.DLTStatsRequest = request as IPCMessages.DLTStatsRequest;
        // return new Promise((resolve, reject) => {
        const hrstart = process.hrtime();
        this._logger.debug("calling _onDLTStatsRequest with params: " + JSON.stringify(req));
        const [futureRes, cancel]: [Promise<AsyncResult>, () => void] = indexer.dltStatsAsync(
            req.file,
            TimeUnit.fromSeconds(60),
            (ticks: ITicks) => {
                // if (onProgress !== undefined) {
                //     onProgress(ticks);
                // }
            },
            (e: StatisticInfo) => {
                // stats
                response(
                    new IPCMessages.DLTStatsResponse({
                        stats: e,
                        id: req.id,
                        session: req.session,
                        logs: undefined,
                    }),
                );
            },
        );
        futureRes.then(x => {
            const hrend = process.hrtime(hrstart);
            const ms = Math.round(hrend[0] * 1000 + hrend[1] / 1000000);
            this._logger.debug("readAndWrite task finished, result: " + x);
            this._logger.debug("Execution time for indexing : " + ms + "ms");
        });

        // });

        // const lvin: Lvin = new Lvin();
        // lvin.dltStat({ srcFile: req.file }).then((results: IDLTStatsResults) => {
        //     if (results.logs instanceof Array) {
        //         results.logs.forEach((log: ILogMessage) => {
        //             ServiceElectron.IPC.send(new IPCMessages.Notification({
        //                 type: log.severity,
        //                 row: log.line_nr === null ? undefined : log.line_nr,
        //                 file: log.file_name,
        //                 message: log.text,
        //                 caption: path.basename(req.file),
        //                 session: req.session,
        //             }));
        //         });
        //     }
        //     response(new IPCMessages.DLTStatsResponse({
        //         stats: results.stats,
        //         id: req.id,
        //         session: req.session,
        //         logs: results.logs,
        //     }));
        // }).catch((error: Error) => {
        //     response(new IPCMessages.DLTStatsResponse({
        //         stats: undefined,
        //         id: req.id,
        //         session: req.session,
        //         error: error.message,
        //     }));
        // });
    }
}

export default new ServiceDLTFiles();
