import * as Toolkit from 'chipmunk.client.toolkit';

import { Observable, Subject } from 'rxjs';
import { IService } from '../interfaces/interface.service';
import { AControllerFileOptions } from '../interfaces/interface.controller.file.options';
import { ControllerDltFileOptions } from '../controller/file.options/controller.file.dlt';
import { Session } from '../controller/session/session';
import { Storage } from '../controller/helpers/virtualstorage';

import ServiceElectronIpc, { IPC, Subscription, TResponseFunc } from './service.electron.ipc';

import EventsHubService from './standalone/service.eventshub';

enum EFileTypes {
    dlt = 'dlt',
}

type TFileTypes = 'dlt';

const CControllers = {
    [EFileTypes.dlt]: ControllerDltFileOptions,
};

const CMetaRegs = {
    [EFileTypes.dlt]: /^dlt/gi,
};

type TReopenCallback = () => void;

export class FileOptionsService implements IService {
    private _subscriptions: { [key: string]: Subscription } = {};
    private _logger: Toolkit.Logger = new Toolkit.Logger('FileOptionsService');
    private _subjects = {
        onFileOpenRequest: new Subject<void>(),
    };

    constructor() {}

    public init(): Promise<void> {
        return new Promise((resolve) => {
            this._subscriptions.FileGetOptionsRequest = ServiceElectronIpc.subscribe(
                IPC.FileGetOptionsRequest,
                this._onRequest.bind(this),
            );
            resolve();
        });
    }

    public getName(): string {
        return 'FileOptionsService';
    }

    public desctroy(): Promise<void> {
        return new Promise((resolve) => {
            Object.keys(this._subscriptions).forEach((key: string) => {
                this._subscriptions[key].destroy();
            });
            resolve();
        });
    }

    public getObservable(): {
        onFileOpenRequest: Observable<void>;
    } {
        return {
            onFileOpenRequest: this._subjects.onFileOpenRequest.asObservable(),
        };
    }

    public hasOptions(meta: string): boolean {
        return this._getOptionsController(meta) !== undefined;
    }

    public getReopenOptionsCallback<T>(
        session: Session,
        meta: string,
        file: string,
        storage: Storage<T>,
    ): TReopenCallback | undefined {
        const classRef: Function | undefined = this._getOptionsController(meta);
        if (classRef === undefined) {
            return undefined;
        }
        return () => {
            // Create instance of controller
            const inst: AControllerFileOptions = new (classRef as any)();
            // Call reopen functionlity
            inst.reopen(file, storage.get())
                .then((opt: any) => {
                    // Drop current session
                    session
                        .resetSessionContent()
                        .then(() => {
                            // Open file again
                            ServiceElectronIpc.request<IPC.FileOpenResponse>(
                                new IPC.FileOpenRequest({
                                    file: file,
                                    options: opt,
                                    session: session.getGuid(),
                                }),
                                IPC.FileOpenResponse,
                            )
                                .then((response) => {
                                    if (response.error) {
                                        this._logger.error(
                                            `Fail reopen file due error: ${response.error}`,
                                        );
                                    }
                                    storage.set(opt);
                                    // TODO: update reopener handler (because OPTIONS were updated)
                                })
                                .catch((openError: Error) => {
                                    this._logger.error(
                                        `Unexpected error during reopening file: ${openError.message}`,
                                    );
                                });
                        })
                        .catch((error: Error) => {
                            this._logger.error(
                                `Fail to drop session content due error: ${error.message}`,
                            );
                        });
                })
                .catch((getOptionsError: Error) => {
                    this._logger.error(
                        `Fail to get options for file "${file}" due error: ${getOptionsError.message}`,
                    );
                });
        };
    }

    private _getOptionsController(meta: string): Function | undefined {
        let alias: EFileTypes | undefined;
        Object.keys(CMetaRegs).forEach((key: string) => {
            if (
                (CMetaRegs as any)[key] !== undefined &&
                meta.search((CMetaRegs as any)[key]) !== -1
            ) {
                alias = key as EFileTypes;
            }
        });
        if (alias === undefined || CControllers[alias] === undefined) {
            return undefined;
        }
        return CControllers[alias];
    }

    private _onRequest(request: IPC.FileGetOptionsRequest, response: TResponseFunc) {
        this._subjects.onFileOpenRequest.next();
        EventsHubService.getSubject().onKeepScrollPrevent.next(undefined);
        const fileType: string = request.type;
        if ((CControllers as any)[fileType] === undefined) {
            response(
                new IPC.FileGetOptionsResponse({
                    allowed: true,
                }),
            ).catch((error: Error) => {
                this._logger.error(`Fail to send response due error: ${error.message}`);
            });
            return;
        }
        // Create instance of controller
        const inst: AControllerFileOptions = new (CControllers as any)[fileType](request);
        // Request options
        inst.getOptions(request)
            .then((options: any) => {
                // Send options for file
                return response(
                    new IPC.FileGetOptionsResponse({
                        allowed: true,
                        options: options,
                    }),
                ).catch((error: Error) => {
                    this._logger.error(
                        `Fail to send response for file "${fileType}" due error: ${error.message}`,
                    );
                });
            })
            .catch((getOptionsError: Error) => {
                this._logger.error(
                    `Fail to get options for file "${fileType}" due error: ${getOptionsError.message}`,
                );
                // Disallow opening file
                return response(
                    new IPC.FileGetOptionsResponse({
                        allowed: false,
                    }),
                ).catch((error: Error) => {
                    this._logger.error(`Fail to send response due error: ${error.message}`);
                });
            });
    }
}

export default new FileOptionsService();
