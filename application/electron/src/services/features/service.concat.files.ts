import ServiceElectron, { IPCMessages } from "../service.electron";
import ServiceStreams, { IStreamInfo } from "../service.streams";
import Logger from "../../tools/env.logger";
import { Subscription } from "../../tools/index";
import { IService } from "../../interfaces/interface.service";
import { IFile } from "../../../../ipc/electron.ipc.messages/concat.files.request";
import ConcatFiles from "../../controllers/features/concat/concat.files";
import { Progress } from "indexer-neon";
import * as Tools from "../../tools/index";
import { IMapItem } from "../../controllers/files.parsers/interface";

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
        // Get destination file TODO dmitry: please re-check
        const dest: { streamId: string; file: string } | Error = ServiceStreams.getStreamFile();
        if (dest instanceof Error) {
            throw dest;
        }
        const controller: ConcatFiles = new ConcatFiles(
            req.session,
            req.files.map((file: IFile) => {
                return {
                    file: file.file,
                    parser: file.parser,
                };
            }),
            (ticks: Progress.ITicks) => {
                ServiceStreams.updateProgressSession(
                    trackingId,
                    ticks.ellapsed / ticks.total,
                    req.session,
                );
            },
        );
        controller
            .write((map: IMapItem[]) => {
                ServiceStreams.pushToStreamFileMap(dest.streamId, map);
            })
            .then((res: number) => {
                response(
                    new IPCMessages.ConcatFilesResponse({
                        written: res,
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
