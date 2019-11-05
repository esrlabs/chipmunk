import ServiceElectron, { IPCMessages } from "../service.electron";
import ServiceStreams, { IStreamInfo } from "../service.streams";
import Logger from "../../tools/env.logger";
import { Subscription } from "../../tools/index";
import { IService } from "../../interfaces/interface.service";
import { IFile } from "../../../../ipc/electron.ipc.messages/concat.files.request";
import ConcatFiles from "../../controllers/features/concat/concat.files";
import { ITicks } from "indexer-neon";
import * as Tools from "../../tools/index";
import { IConcatenatorResult } from "indexer-neon/dist/progress";

/**
 * @class ServiceConcatFiles
 * @description Providers access to merge files functionality from render
 */

class ServiceConcatFiles implements IService {
    private _logger: Logger = new Logger("ServiceConcatFiles");
    // Should detect by executable file
    private _subscription: { [key: string]: Subscription } = {};

    /**
     * Initialization function
     * @returns Promise<void>
     */
    public init(): Promise<void> {
        return new Promise((resolve, reject) => {
            Promise.all([
                new Promise((resolveSubscription, rejectSubscription) => {
                    ServiceElectron.IPC.subscribe(
                        IPCMessages.ConcatFilesRequest,
                        this._onConcatFilesRequest.bind(this),
                    )
                        .then((subscription: Subscription) => {
                            this._subscription.ConcatFilesRequest = subscription;
                            resolveSubscription();
                        })
                        .catch((error: Error) => {
                            this._logger.error(`Fail to init module due error: ${error.message}`);
                            rejectSubscription(error);
                        });
                }),
            ])
                .then(() => {
                    resolve();
                })
                .catch((error: Error) => {
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
        return "ServiceConcatFiles";
    }

    private _onConcatFilesRequest(
        request: IPCMessages.TMessage,
        response: (instance: IPCMessages.TMessage) => any,
    ) {
        const req: IPCMessages.ConcatFilesRequest = request as IPCMessages.ConcatFilesRequest;
        const trackingId: string = Tools.guid();
        const controller: ConcatFiles = new ConcatFiles(
            req.session,
            req.files.map((file: IFile) => {
                return {
                    file: file.file,
                    parser: file.parser,
                };
            }),
            (ticks: ITicks) => {
                ServiceStreams.updateProgressSession(
                    trackingId,
                    ticks.ellapsed / ticks.total,
                    req.session,
                );
            },
        );
        controller
            .write()
            .then((res: IConcatenatorResult) => {
                response(
                    new IPCMessages.ConcatFilesResponse({
                        written: res.line_cnt,
                        id: req.id,
                    }),
                );
            })
            .catch((mergeError: Error) => {
                response(
                    new IPCMessages.ConcatFilesResponse({
                        written: 0,
                        id: req.id,
                        error: mergeError.message,
                    }),
                );
            })
            .finally(() => {
                ServiceStreams.removeProgressSession(trackingId, req.session);
            });
    }
}

export default new ServiceConcatFiles();
