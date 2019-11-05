import ServiceElectron, { IPCMessages } from "../service.electron";
import Logger from "../../tools/env.logger";
import * as Tools from '../../tools/index';
import { Subscription } from "../../tools/index";
import { IService } from "../../interfaces/interface.service";
import { indexer, ITicks, TimeUnit, StatisticInfo, AsyncResult } from "indexer-neon";
import ServiceStreams from '../../services/service.streams';

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

        // Create unique track id
        const trackId: string = Tools.guid();

        ServiceStreams.addProgressSession(
            trackId,
            "Some good name for track (will be shown in UI)",
            req.session,
        );

        // return new Promise((resolve, reject) => {
        const hrstart = process.hrtime();
        this._logger.debug("calling _onDLTStatsRequest with params: " + JSON.stringify(req));
        let stats: StatisticInfo | undefined;
        const [futureRes, cancel]: [Promise<AsyncResult>, () => void] = indexer.dltStatsAsync(
            req.file,
            TimeUnit.fromSeconds(60),
            (ticks: ITicks) => {
                const value: number = ticks.ellapsed / ticks.total; // 0 < value < 1
                ServiceStreams.updateProgressSession(trackId, value, req.session);
            },
            (e: StatisticInfo) => {
                // stats
                stats = e;
            },
        );
        futureRes
            .then((x: AsyncResult) => {
                this._logger.debug("readAndWrite task finished, result: " + AsyncResult[x]);
                response(
                    new IPCMessages.DLTStatsResponse({
                        stats,
                        id: req.id,
                        session: req.session,
                        logs: undefined,
                    }),
                );
            })
            .catch(e => {
                this._logger.warn("exception in dltStatsAsync: " + e);
            })
            .finally(() => {
                // After operation is finished
                const hrend = process.hrtime(hrstart);
                const ms = Math.round(hrend[0] * 1000 + hrend[1] / 1000000);
                this._logger.debug("Execution time for indexing : " + ms + "ms");
                ServiceStreams.removeProgressSession(trackId, req.session);
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
