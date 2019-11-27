import ServiceElectron, { IPCMessages } from "../service.electron";
import ServiceStreams, { IStreamInfo } from "../service.streams";
import Logger from "../../tools/env.logger";
import { Subscription } from "../../tools/index";
import { IService } from "../../interfaces/interface.service";
import { IFile } from "../../../../common/ipc/electron.ipc.messages/concat.files.request";
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
    private _subscriptions: { [key: string]: Subscription } = {};
    private _tasks: Map<string, ConcatFiles> = new Map<string, ConcatFiles>();

    /**
     * Initialization function
     * @returns Promise<void>
     */
    public init(): Promise<void> {
        return new Promise((resolve, reject) => {
            ServiceElectron.IPC.subscribe(IPCMessages.ConcatFilesRequest, this._onConcatFilesRequest.bind(this)).then((subscription: Subscription) => {
                this._subscriptions.ConcatFilesRequest = subscription;
                this._subscriptions.onSessionClosed = ServiceStreams.getSubjects().onSessionClosed.subscribe(this._onSessionClosed.bind(this));
                resolve();
            }).catch((error: Error) => {
                this._logger.error(`Fail to init module due error: ${error.message}`);
                reject(error);
            });
        });
    }

    public destroy(): Promise<void> {
        return new Promise(resolve => {
            Object.keys(this._subscriptions).forEach((key: string) => {
                this._subscriptions[key].destroy();
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
        // Get destination file TODO dmitry: please re-check
        const dest: { streamId: string; file: string } | Error = ServiceStreams.getStreamFile(req.session);
        if (dest instanceof Error) {
            return response(new IPCMessages.ConcatFilesResponse({
                written: 0,
                id: req.id,
                error: `Fail concat file due error: ${dest.message}`,
            }));
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
                    req.id,
                    ticks.ellapsed / ticks.total,
                    req.session,
                );
            },
        );
        controller.write((map: IMapItem[]) => {
            ServiceStreams.pushToStreamFileMap(dest.streamId, map);
        }).then((res: number) => {
            response(
                new IPCMessages.ConcatFilesResponse({
                    written: res,
                    id: req.id,
                }),
            );
        }).catch((mergeError: Error) => {
            response(
                new IPCMessages.ConcatFilesResponse({
                    written: 0,
                    id: req.id,
                    error: mergeError.message,
                }),
            );
        }).cancel(() => {
            response(new IPCMessages.ConcatFilesResponse({
                written: 0,
                id: req.id,
                error: `Operation is canceled`,
            }));
        }).finally(() => {
            ServiceStreams.removeProgressSession(req.id, req.session);
            this._tasks.delete(req.session);
        });
        // Store
        this._tasks.set(req.session, controller);
    }

    private _onSessionClosed(guid: string) {
        // Checking for active task
        const controller: ConcatFiles | undefined = this._tasks.get(guid);
        if (controller === undefined) {
            return;
        }
        controller.abort().then(() => {
            this._logger.env(`Task is aborted`);
        });
    }
}

export default new ServiceConcatFiles();
