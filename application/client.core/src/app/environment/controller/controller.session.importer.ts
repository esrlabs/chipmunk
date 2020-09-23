import { IImportedData, Importable } from './controller.session.importer.interface';
import { IPCMessages } from '../services/service.electron.ipc';
import ServiceElectronIpc from '../services/service.electron.ipc';

import * as Toolkit from 'chipmunk.client.toolkit';

export class ControllerSessionImporter {

    private _controllers: Importable[];
    private _logger: Toolkit.Logger;
    private _session: string;

    constructor(session: string, controllers: Importable[]) {
        this._logger = new Toolkit.Logger(`ControllerSessionImporter ${session}`);
        this._controllers = controllers;
        this._session = session;
    }

    public export(): Promise<void> {
        return new Promise((resolve, reject) => {
            const toBeExported: IPCMessages.ISessionImporterData[] = [];
            Promise.all(this._controllers.map((controller: Importable) => {
                return new Promise((res) => {
                    controller.export().then((data: IImportedData | undefined) => {
                        if (data !== undefined) {
                            toBeExported.push({
                                hash: data.hash,
                                data: data.data,
                                controller: controller.getImporterUUID(),
                            });
                        }
                    }).catch((err: Error) => {
                        this._logger.warn(`Fail to export data for "${controller.getImporterUUID()}" due error: ${err.message}`);
                    }).finally(res);
                });
            })).then(() => {
                if (toBeExported.length === 0) {
                    return resolve();
                }
                ServiceElectronIpc.request(new IPCMessages.SessionImporterSaveRequest({
                    session: this._session,
                    data: toBeExported,
                }), IPCMessages.SessionImporterSaveResponse).then((response: IPCMessages.SessionImporterSaveResponse) => {
                    if (response.error !== undefined) {
                        reject(new Error(this._logger.warn(`Fail to export data due error: ${response.error}`)));
                    } else {
                        resolve();
                    }
                }).catch((err: Error) => {
                    reject(new Error(this._logger.warn(`Fail to export data due error: ${err.message}`)));
                });
            }).catch((err: Error) => {
                reject(new Error(this._logger.warn(`Fail to finish export due error: ${err.message}`)));
            });

        });
    }

    public import(): Promise<void> {
        return new Promise((resolve, reject) => {
            ServiceElectronIpc.request(new IPCMessages.SessionImporterLoadRequest({
                session: this._session,
            }), IPCMessages.SessionImporterLoadResponse).then((response: IPCMessages.SessionImporterLoadResponse) => {
                if (response.error !== undefined) {
                    return reject(new Error(this._logger.warn(`Fail to import data due error: ${response.error}`)));
                }
                if (response.data === undefined) {
                    return resolve();
                }
                Promise.all(response.data.map((pack: IPCMessages.ISessionImporterData) => {
                    return new Promise((res) => {
                        const controller: Importable | undefined = this._controllers.find(c => c.getImporterUUID() === pack.controller);
                        if (controller === undefined) {
                            this._logger.warn(`Fail to find controller for "${pack.controller}". Fail to import data for it.`);
                            return res();
                        }
                        controller.import({ data: pack.data, hash: pack.hash }).catch((err: Error) => {
                            this._logger.warn(`Fail import data for "${pack.controller}" due error: ${err.message}`);
                        }).finally(res);
                    });
                })).then(() => {
                    resolve();
                }).catch((err: Error) => {
                    reject(new Error(this._logger.warn(`Fail to finish import due error: ${err.message}`)));
                });
            }).catch((err: Error) => {
                reject(new Error(this._logger.warn(`Fail to import data due error: ${err.message}`)));
            });
        });
    }

}
