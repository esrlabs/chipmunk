import ServiceElectron, { IPCMessages } from "../service.electron";
import Logger from "../../tools/env.logger";
import * as Tools from "../../tools/index";
import { Subscription } from "../../tools/index";
import { IService } from "../../interfaces/interface.service";
import indexer, { Progress, DLT, CancelablePromise } from "indexer-neon";
import ServiceStreams from "../service.sessions";

/**
 * @class ServiceDLTFiles
 * @description Providers access to merge files functionality from render
 */

class ServiceDLTFiles implements IService {
    private _logger: Logger = new Logger("ServiceDLTFiles");
    // Should detect by executable file
    private _subscription: { [key: string]: Subscription } = {};
    private _tasks: Map<string, CancelablePromise<void, void, DLT.TDltStatsEvents, DLT.TDltStatsEventObject>> = new Map();

    /**
     * Initialization function
     * @returns Promise<void>
     */
    public init(): Promise<void> {
        return new Promise((resolve, reject) => {
            Promise.all([
                ServiceElectron.IPC.subscribe(IPCMessages.DLTStatsRequest, this._onDLTStatsRequest.bind(this)).then((subscription: Subscription) => {
                    this._subscription.DLTStatsRequest = subscription;
                }),
                ServiceElectron.IPC.subscribe(IPCMessages.DLTStatsCancelRequest, this._onDLTStatsCancelRequest.bind(this)).then((subscription: Subscription) => {
                    this._subscription.DLTStatsCancelRequest = subscription;
                }),
            ]).then(() => {
                resolve();
            }).catch((error: Error) => {
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

    private _onDLTStatsRequest(request: IPCMessages.TMessage, response: (instance: IPCMessages.TMessage) => any) {
        const req: IPCMessages.DLTStatsRequest = request as IPCMessages.DLTStatsRequest;
        const taskId: string = req.id;
        // Create unique track id
        ServiceStreams.addProgressSession(
            taskId,
            "Getting DLT stats",
            req.session,
        );
        // return new Promise((resolve, reject) => {
        const hrstart = process.hrtime();
        this._logger.debug("calling _onDLTStatsRequest with params: " + JSON.stringify(req));
        let stats: DLT.StatisticInfo | undefined;
        const task: CancelablePromise<void, void, DLT.TDltStatsEvents, DLT.TDltStatsEventObject> = indexer.dltStatsAsync(req.file).then(() => {
            this._logger.debug("dltStatsAsync task finished");
            response(
                new IPCMessages.DLTStatsResponse({
                    stats: stats,
                    id: taskId,
                    session: req.session,
                    logs: undefined,
                }),
            );
        }).canceled(() => {
            response(new IPCMessages.DLTStatsResponse({
                stats: undefined,
                id: taskId,
                session: req.session,
                logs: undefined,
                error: 'Task is canceled',
            }));
        }).catch((error: Error) => {
            this._logger.warn(`Exception in dltStatsAsync: ${error.message}`);
            response(new IPCMessages.DLTStatsResponse({
                stats: undefined,
                id: taskId,
                session: req.session,
                logs: undefined,
                error: `Fail to finish task due error: ${error.message}`,
            }));
        }).finally(() => {
            // After operation is finished
            const hrend = process.hrtime(hrstart);
            const ms = Math.round(hrend[0] * 1000 + hrend[1] / 1000000);
            this._logger.debug("Execution time for indexing : " + ms + "ms");
            ServiceStreams.removeProgressSession(taskId, req.session);
            this._tasks.delete(taskId);
        }).on('config', (event: DLT.StatisticInfo) => {
            // stats
            stats = event;
            this._logger.debug(`_onDLTStatsRequest: received config, contained non-verbose logs: ${event.contained_non_verbose}`);
        }).on('progress', (event: Progress.ITicks) => {
            const value: number = event.ellapsed / event.total; // 0 < value < 1
            ServiceStreams.updateProgressSession(taskId, value, req.session);
        });
        this._tasks.set(taskId, task);
    }

    private _onDLTStatsCancelRequest(request: IPCMessages.TMessage, response: (instance: IPCMessages.TMessage) => any) {
        const req: IPCMessages.DLTStatsCancelRequest = request as IPCMessages.DLTStatsCancelRequest;
        const task: CancelablePromise<void, void> | undefined = this._tasks.get(req.id);
        if (task === undefined) {
            return response(new IPCMessages.DLTStatsCancelResponse({
                id: req.id,
                session: req.session,
                error: `No task found with id "${req.id}". Probably task is already other.`,
            }));
        }
        task.canceled(() => {
            this._tasks.delete(req.id);
            response(new IPCMessages.DLTStatsCancelResponse({
                id: req.id,
                session: req.session,
            }));
        }).abort();
    }
}

export default new ServiceDLTFiles();
