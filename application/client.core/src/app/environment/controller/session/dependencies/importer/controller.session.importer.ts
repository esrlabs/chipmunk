import { IImportedData, Importable } from './controller.session.importer.interface';
import { IPC, Subscription as IPCSubscription } from '../../../../services/service.electron.ipc';
import { Subscription } from 'rxjs';
import { getHash } from '../../../helpers/hash';
import { Dependency, SessionGetter } from '../session.dependency';

import ServiceElectronIpc from '../../../../services/service.electron.ipc';

import * as Toolkit from 'chipmunk.client.toolkit';

export class ControllerSessionImporter implements Dependency {
    private _controllers: Importable<any>[] = [];
    private _logger: Toolkit.Logger;
    private _uuid: string;
    private _subscriptions: { [key: string]: IPCSubscription | Subscription } = {};
    private _lastOperationHash: string = '';
    private _session: SessionGetter;
    private _locked: boolean = true;
    private _ready: boolean = false;
    private _opened: boolean = false;

    constructor(uuid: string, getter: SessionGetter) {
        this._uuid = uuid;
        this._session = getter;
        this._logger = new Toolkit.Logger(`ControllerSessionImporter ${uuid}`);
    }

    public init(): Promise<void> {
        return new Promise((resolve, reject) => {
            this._controllers = this._session().getImportable();
            this._subscriptions.FileOpenDoneEvent = ServiceElectronIpc.subscribe(
                IPC.FileOpenDoneEvent,
                this._onFileOpenDoneEvent.bind(this),
            );
            this._subscriptions.onSessionChange = this._session()
                .getSessionEventsHub()
                .subscribe()
                .onSessionChange(this._onSessionChange.bind(this));
            this._controllers.forEach((controller: Importable<any>) => {
                this._subscriptions[controller.getImporterUUID()] = controller
                    .getExportObservable()
                    .subscribe(this._onExportTriggered.bind(this));
            });
            resolve();
        });
    }

    public destroy(): Promise<void> {
        return new Promise((resolve) => {
            Object.keys(this._subscriptions).forEach((key: string) => {
                this._subscriptions[key].unsubscribe();
            });
            resolve();
        });
    }

    public getName(): string {
        return 'ControllerSessionImporter';
    }

    public export(): Promise<void> {
        return new Promise((resolve, reject) => {
            if (this._locked) {
                return resolve(undefined);
            }
            const toBeExported: IPC.ISessionImporterData[] = [];
            Promise.all(
                this._controllers.map((controller: Importable<any>) => {
                    return new Promise((res) => {
                        controller
                            .export()
                            .then((data: any | undefined) => {
                                if (data !== undefined) {
                                    const stringified: string = JSON.stringify(data);
                                    toBeExported.push({
                                        hash: getHash(stringified),
                                        data: stringified,
                                        controller: controller.getImporterUUID(),
                                    });
                                }
                            })
                            .catch((err: Error) => {
                                this._logger.warn(
                                    `Fail to export data for "${controller.getImporterUUID()}" due error: ${
                                        err.message
                                    }`,
                                );
                            })
                            .finally(() => res(undefined));
                    });
                }),
            )
                .then(() => {
                    if (!this._isActualOperation(toBeExported)) {
                        return resolve(undefined);
                    }
                    ServiceElectronIpc.request<IPC.SessionImporterSaveResponse>(
                        new IPC.SessionImporterSaveRequest({
                            session: this._uuid,
                            data: toBeExported,
                        }),
                        IPC.SessionImporterSaveResponse,
                    )
                        .then((response) => {
                            if (response.error !== undefined) {
                                reject(
                                    new Error(
                                        this._logger.warn(
                                            `Fail to export data due error: ${response.error}`,
                                        ),
                                    ),
                                );
                            } else {
                                resolve(undefined);
                            }
                        })
                        .catch((err: Error) => {
                            reject(
                                new Error(
                                    this._logger.warn(
                                        `Fail to export data due error: ${err.message}`,
                                    ),
                                ),
                            );
                        });
                })
                .catch((err: Error) => {
                    reject(
                        new Error(
                            this._logger.warn(`Fail to finish export due error: ${err.message}`),
                        ),
                    );
                });
        });
    }

    public import(): Promise<void> {
        function getDataFromStr(str: string): any | Error {
            try {
                return JSON.parse(str);
            } catch (e) {
                return e;
            }
        }
        return new Promise((resolve, reject) => {
            ServiceElectronIpc.request<IPC.SessionImporterLoadResponse>(
                new IPC.SessionImporterLoadRequest({
                    session: this._uuid,
                }),
                IPC.SessionImporterLoadResponse,
            )
                .then((response) => {
                    if (response.error !== undefined) {
                        return reject(
                            new Error(
                                this._logger.warn(
                                    `Fail to import data due error: ${response.error}`,
                                ),
                            ),
                        );
                    }
                    if (response.data === undefined) {
                        return resolve(undefined);
                    }
                    Promise.all(
                        response.data.map((pack: IPC.ISessionImporterData) => {
                            return new Promise((res) => {
                                const controller: Importable<any> | undefined =
                                    this._controllers.find(
                                        (c) => c.getImporterUUID() === pack.controller,
                                    );
                                if (controller === undefined) {
                                    this._logger.warn(
                                        `Fail to find controller for "${pack.controller}". Fail to import data for it.`,
                                    );
                                    return res(undefined);
                                }
                                if (getHash(pack.data) !== pack.hash) {
                                    this._logger.warn(
                                        `Fail to parse data for "${pack.controller}" because of hash dismatch`,
                                    );
                                    return res(undefined);
                                }
                                const parsed: any | Error = getDataFromStr(pack.data);
                                if (parsed instanceof Error) {
                                    this._logger.warn(
                                        `Fail to parse data for "${pack.controller}" due error: ${parsed.message}`,
                                    );
                                    return res(undefined);
                                }
                                controller
                                    .import(parsed)
                                    .catch((err: Error) => {
                                        this._logger.warn(
                                            `Fail import data for "${pack.controller}" due error: ${err.message}`,
                                        );
                                    })
                                    .finally(() => res(undefined));
                            });
                        }),
                    )
                        .then(() => {
                            resolve(undefined);
                        })
                        .catch((err: Error) => {
                            reject(
                                new Error(
                                    this._logger.warn(
                                        `Fail to finish import due error: ${err.message}`,
                                    ),
                                ),
                            );
                        });
                })
                .catch((err: Error) => {
                    reject(
                        new Error(
                            this._logger.warn(`Fail to import data due error: ${err.message}`),
                        ),
                    );
                });
        });
    }

    private _isActualOperation(toBeExported: IPC.ISessionImporterData[]): boolean {
        const hash: string =
            toBeExported.length !== 0 ? toBeExported.map((i) => i.hash.toString()).join('-') : '-';
        const actual: boolean = this._lastOperationHash !== hash;
        this._lastOperationHash = hash;
        return actual;
    }

    private _onExportTriggered() {
        this.export().catch((error: Error) => {
            this._logger.warn(`Export failed due error: ${error.message}`);
        });
    }

    private _onSessionChange(session: string) {
        if (this._uuid !== session) {
            return;
        }
        this._subscriptions.onSessionChange.unsubscribe();
        this._ready = true;
        this._import();
    }

    private _onFileOpenDoneEvent(event: IPC.FileOpenDoneEvent) {
        if (this._uuid !== event.session) {
            return;
        }
        this._opened = true;
        this._import();
    }

    private _import() {
        if (!this._opened || !this._ready) {
            return;
        }
        this.import()
            .catch((error: Error) => {
                this._logger.warn(
                    `Import for "${this._uuid}" is failed due error: ${error.message}`,
                );
            })
            .finally(() => {
                this._locked = false;
            });
    }
}
