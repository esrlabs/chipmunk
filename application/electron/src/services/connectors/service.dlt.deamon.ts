import { Subscription } from "../../tools/index";
import { IService } from "../../interfaces/interface.service";
import { DLTConnectionController, IConnectionOptions } from '../../controllers/connections/dlt.connection';
import { dialog, SaveDialogReturnValue } from 'electron';
import { CommonInterfaces } from '../../interfaces/interface.common';
import { CExportSelectionActionId, CExportAllActionId } from '../../consts/output.actions';

import ServiceStreams from "../service.sessions";
import Logger from "../../tools/env.logger";

import ServiceStorage, { IStorageScheme } from '../service.storage';
import ServiceElectron, { IPCMessages } from "../service.electron";
import ServiceOutputExport from "../output/service.output.export";
import { CancelablePromise } from "indexer-neon";

/**
 * @class ServiceDLTDeamonConnector
 * @description Providers access to DLT deamon (UPD)
 */

class ServiceDLTDeamonConnector implements IService {

    private _logger: Logger = new Logger("ServiceDLTDeamonConnector");
    // Should detect by executable file
    private _subscriptions: { [key: string]: Subscription } = {};
    private _connections: Map<string, DLTConnectionController> = new Map();
    private _connectionsHistory: string[] = [];
    // private _saver: CancelablePromise<void, void, DLT.TDLTSocketEvents, DLT.TDLTSocketEventObject> | undefined;

    /**
     * Initialization function
     * @returns Promise<void>
     */
    public init(): Promise<void> {
        return new Promise((resolve, reject) => {
            resolve();
            /*
            this._subscriptions.onSessionClosed = ServiceStreams.getSubjects().onSessionClosed.subscribe(this._onSessionClosed.bind(this));
            Promise.all([
                ServiceElectron.IPC.subscribe(IPCMessages.DLTDeamonConnectRequest, this._onDLTDeamonConnectRequest.bind(this)).then((subscription: Subscription) => {
                    this._subscriptions.DLTDeamonConnectRequest = subscription;
                }),
                ServiceElectron.IPC.subscribe(IPCMessages.DLTDeamonDisconnectRequest, this._onDLTDeamonDisconnectRequest.bind(this)).then((subscription: Subscription) => {
                    this._subscriptions.DLTDeamonDisconnectRequest = subscription;
                }),
                ServiceElectron.IPC.subscribe(IPCMessages.DLTDeamonRecentRequest, this._onDLTDeamonRecentRequest.bind(this)).then((subscription: Subscription) => {
                    this._subscriptions.DLTDeamonRecentRequest = subscription;
                }),
                ServiceElectron.IPC.subscribe(IPCMessages.DLTDeamonRecentDropRequest, this._onDLTDeamonRecentDropRequest.bind(this)).then((subscription: Subscription) => {
                    this._subscriptions.DLTDeamonRecentDropRequest = subscription;
                }),
                ServiceElectron.IPC.subscribe(IPCMessages.DLTDeamonSaveRequest, this._onDLTDeamonSaveRequest.bind(this)).then((subscription: Subscription) => {
                    this._subscriptions.DLTDeamonSaveRequest = subscription;
                }),
            ]).then(() => {
                resolve();
            }).catch((error: Error) => {
                this._logger.error(`Fail to init module due error: ${error.message}`);
                reject(error);
            });
            */
        });
    }

    public destroy(): Promise<void> {
        return new Promise(resolve => {
            Object.keys(this._subscriptions).forEach((key: string) => {
                this._subscriptions[key].destroy();
            });
            Promise.all(Array.from(this._connections.values()).map((connection: DLTConnectionController) => {
                return connection.destroy();
            })).then(() => {
                resolve();
            }).catch((error: Error) => {
                this._logger.error(`Fail to correctly disconnect all due error: ${error.message}`);
                resolve();
            });
        });
    }

    public getName(): string {
        return "ServiceDLTDeamonConnector";
    }

    public saveAs(target: string, type: 'session' | 'file', sections: CommonInterfaces.IIndexSection[] = []): Promise<string | undefined> {
        return new Promise((resolve, reject) => {
            this.getFileName().then((filename: string | undefined) => {
                if (filename === undefined) {
                    return resolve(undefined);
                }
                this._logger.info(`Saving`);
                /*
                this._saver = indexer.exportDltFile(target, type, filename, { sections: sections }).then(() => {
                    this._logger.info(`Saved`);
                    // Resolving
                    resolve(filename);
                }).canceled(() => {
                    this._logger.info(`Saving was canceled`);
                    resolve();
                }).catch((error: Error) => {
                    this._logger.warn(`Exception during saving: ${error.message}`);
                    reject(error);
                }).finally(() => {
                    this._saver = undefined;
                }).on('progress', (event: Progress.ITicks) => {
                    // TODO: Do we need this event at all?
                });
                */
            }).catch((error: Error) => {
                reject(error);
            });
        });
    }

    public getFileName(): Promise<string | undefined> {
        return new Promise((resolve, reject) => {
            const win = ServiceElectron.getBrowserWindow();
            if (win === undefined) {
                return;
            }
            dialog.showSaveDialog(win, {
                title: 'Saving DLT stream',
                filters: [{
                    name: 'DLT Files',
                    extensions: ['dlt'],
                }],
            }).then((returnValue: SaveDialogReturnValue) => {
                resolve(returnValue.filePath);
            }).catch((error: Error) => {
                this._logger.error(`Fail get filename for saving due error: ${error.message}`);
                reject(error);
            });
        });
    }

    private _onDLTDeamonConnectRequest(request: IPCMessages.TMessage, response: (instance: IPCMessages.TMessage) => any) {
        const req: IPCMessages.DLTDeamonConnectRequest = request as IPCMessages.DLTDeamonConnectRequest;
        if (this._connections.has(req.session)) {
            return response(
                new IPCMessages.DLTDeamonConnectResponse({
                    id: req.id,
                    session: req.session,
                    error: `Fail to create new connection, because connection already exists for session "${req.session}"`,
                }),
            );
        }
        // Create connection
        const options: IConnectionOptions = {
            ecu: req.ecu,
            bindingAddress: req.bindingAddress,
            bindingPort: req.bindingPort,
            multicastInterface: req.multicastInterface,
            multicastAddress: req.multicastAddress,
            fibex: req.fibex,
        };
        const connection: DLTConnectionController = new DLTConnectionController(
            req.id,
            req.session,
            options,
        );
        // Scope connection state
        const state: {
            connected: boolean,
            error: boolean,
        } = {
            connected: false,
            error: false,
        };
        // Try to connect
        connection.connect().then(() => {
            // Store connection
            this._connections.set(req.session, connection);
            // Listen connect event
            connection.once(DLTConnectionController.Events.connect, () => {
                if (state.error) {
                    return;
                }
                // Save session data into history
                if (this._connectionsHistory.indexOf(req.session) === -1) {
                    this._connectionsHistory.push(req.session);
                    // Register exports callback
                    ServiceOutputExport.setAction(req.session, CExportAllActionId, {
                        caption: 'Export all',
                        handler: this._exportAll.bind(this, req.session),
                        isEnabled: this._isExportPossible.bind(this, req.session),
                    });
                    ServiceOutputExport.setAction(req.session, CExportSelectionActionId, {
                        caption: 'Export selection',
                        handler: this._exportSelection.bind(this, req.session),
                        isEnabled: this._isExportPossible.bind(this, req.session),
                    });
                }
                // Response to client
                response(
                    new IPCMessages.DLTDeamonConnectResponse({
                        id: req.id,
                        session: req.session,
                    }),
                );
                // Send notification
                ServiceElectron.IPC.send(new IPCMessages.DLTDeamonConnectEvent({
                    id: req.id,
                    session: req.session,
                })).catch((error: Error) => {
                    this._logger.warn(`Fail to notify front-end about connection due error: ${error.message}`);
                });
                // Save/update recent data
                this._updateRecent(options);
                this._logger.info(`connected`);
                state.connected = true;
            });
            // Listen disconnect event
            connection.once(DLTConnectionController.Events.disconnect, () => {
                this._logger.info(`disconnected`);
                connection.removeAllListeners();
                this._connections.delete(req.session);
                ServiceElectron.IPC.send(new IPCMessages.DLTDeamonDisconnectEvent({
                    id: req.id,
                    session: req.session,
                })).catch((error: Error) => {
                    this._logger.warn(`Fail to notify front-end about disconnection due error: ${error.message}`);
                });
            });
            // Lsiten for error
            connection.once(DLTConnectionController.Events.error, (error: Error) => {
                if (!state.connected) {
                    // This error happened before connection
                    response(
                        new IPCMessages.DLTDeamonConnectResponse({
                            id: req.id,
                            session: req.session,
                            error: `Fail to connect due error: ${error.message}`,
                        }),
                    );
                } else {
                    // This error happened after connection
                }
                this._logger.warn(`error: ${error.message}`);
                state.error = true;
            });
        }).catch((connectingError: Error) => {
            response(
                new IPCMessages.DLTDeamonConnectResponse({
                    id: req.id,
                    session: req.session,
                    error: `Fail to create new connection due error: ${connectingError.message}`,
                }),
            );
        });
    }

    private _onDLTDeamonDisconnectRequest(request: IPCMessages.TMessage, response: (instance: IPCMessages.TMessage) => any) {
        const req: IPCMessages.DLTDeamonDisconnectRequest = request as IPCMessages.DLTDeamonDisconnectRequest;
        const connection: DLTConnectionController | undefined = this._connections.get(req.session);
        if (connection === undefined) {
            return response(
                new IPCMessages.DLTDeamonConnectResponse({
                    id: req.id,
                    session: req.session,
                    error: `Fail to disconnect, because it wasn't connected or already was disconnected`,
                }),
            );
        }
        connection.destroy().then(() => {
            connection.removeAllListeners();
            this._connections.delete(req.session);
            ServiceElectron.IPC.send(new IPCMessages.DLTDeamonDisconnectEvent({
                id: req.id,
                session: req.session,
            })).catch((error: Error) => {
                this._logger.warn(`Fail to notify front-end about disconnection due error: ${error.message}`);
            });
            return response(
                new IPCMessages.DLTDeamonConnectResponse({
                    id: req.id,
                    session: req.session,
                }),
            );
        }).catch((error: Error) => {
            response(
                new IPCMessages.DLTDeamonConnectResponse({
                    id: req.id,
                    session: req.session,
                    error: `Fail to remove connection due error: ${error.message}`,
                }),
            );
        });
    }

    private _onDLTDeamonRecentRequest(request: IPCMessages.TMessage, response: (instance: IPCMessages.TMessage) => any) {
        const stored: IStorageScheme.IConnectionOptions[] = ServiceStorage.get().get().recentDLTConnectorSettings;
        response(
            new IPCMessages.DLTDeamonRecentResponse({
                recent: stored instanceof Array ? stored : [],
            }),
        );
    }

    private _onDLTDeamonRecentDropRequest(request: IPCMessages.TMessage, response: (instance: IPCMessages.TMessage) => any) {
        ServiceStorage.get().set({
            recentDLTConnectorSettings: [],
        }).catch((err: Error) => {
            this._logger.error(err.message);
        });
        response(
            new IPCMessages.DLTDeamonRecentDropResponse(),
        );
    }

    private _onDLTDeamonSaveRequest(request: IPCMessages.TMessage, response: (instance: IPCMessages.TMessage) => any) {
        const req: IPCMessages.DLTDeamonSaveRequest = request as IPCMessages.DLTDeamonSaveRequest;
        if (this._connectionsHistory.indexOf(req.session) === -1) {
            return response(
                new IPCMessages.DLTDeamonSaveResponse({
                    session: req.session,
                    error: `Fail to find connection for session "${req.session}"`,
                }),
            );
        }
        this.saveAs(req.session, 'session').then((filename: string | undefined) => {
            response(
                new IPCMessages.DLTDeamonSaveResponse({
                    session: req.session,
                    filename: filename,
                }),
            );
        }).catch((error: Error) => {
            this._logger.error(`Fail to save DLT Stream due error: ${error.message}`);
            response(
                new IPCMessages.DLTDeamonSaveResponse({
                    session: req.session,
                    error: error.message,
                }),
            );
        });
    }

    private _onSessionClosed(guid: string) {
        // Checking for active task
        const connection: DLTConnectionController | undefined = this._connections.get(guid);
        if (connection === undefined) {
            return;
        }
        connection.destroy().then(() => {
            this._connections.delete(guid);
        }).catch((error: Error) => {
            this._logger.error(`Fail to disconnect in scope of the session "${guid}" due error: ${error.message}`);
        });
    }

    private _updateRecent(settings: IConnectionOptions) {
        let stored: IStorageScheme.IConnectionOptions[] = ServiceStorage.get().get().recentDLTConnectorSettings;
        let updated: IStorageScheme.IConnectionOptions | undefined;
        stored = stored.filter((recent: IStorageScheme.IConnectionOptions) => {
            if (recent.ecu === settings.ecu) {
                return false;
            }
            return true;
        });
        if (updated === undefined) {
            updated = settings;
        }
        stored.unshift(updated);
        ServiceStorage.get().set({
            recentDLTConnectorSettings: stored,
        }).catch((err: Error) => {
            this._logger.error(err.message);
        });
    }

    private _exportSelection(session: string, request: IPCMessages.OutputExportFeaturesRequest | IPCMessages.OutputExportFeatureCallRequest): Promise<void> {
        return new Promise((resolve, reject) => {
            const sections: CommonInterfaces.IIndexSection[] = request.selection.map((range) => {
                return { first_line: range.from, last_line: range.to };
            });
            this.saveAs(session, 'session', sections).then(() => {
                resolve();
            }).catch((saveErr: Error) => {
                this._logger.warn(`Fail to save stream data due error: ${saveErr.message}`);
                reject(saveErr);
            });
        });
    }

    private _exportAll(session: string): Promise<void> {
        return new Promise((resolve, reject) => {
            this.saveAs(session, 'session').then(() => {
                resolve();
            }).catch((saveErr: Error) => {
                this._logger.warn(`Fail to save stream data due error: ${saveErr.message}`);
                reject(saveErr);
            });
        });
    }

    private _isExportPossible(session: string, request: IPCMessages.OutputExportFeaturesRequest | IPCMessages.OutputExportFeatureCallRequest): boolean {
        if (this._connections.has(session)) {
            return false;
        }
        return true;
    }

}

export default new ServiceDLTDeamonConnector();
