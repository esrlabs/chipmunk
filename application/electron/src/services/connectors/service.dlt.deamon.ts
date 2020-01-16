import ServiceElectron, { IPCMessages } from "../service.electron";
import Logger from "../../tools/env.logger";
import { Subscription } from "../../tools/index";
import { IService } from "../../interfaces/interface.service";
import ServiceStreams from "../service.streams";
import { DLTConnectionController } from '../../controllers/connections/dlt.connection';

/**
 * @class ServiceDLTDeamonConnector
 * @description Providers access to DLT deamon (UPD)
 */

class ServiceDLTDeamonConnector implements IService {

    private _logger: Logger = new Logger("ServiceDLTDeamonConnector");
    // Should detect by executable file
    private _subscriptions: { [key: string]: Subscription } = {};
    private _connections: Map<string, DLTConnectionController> = new Map();

    /**
     * Initialization function
     * @returns Promise<void>
     */
    public init(): Promise<void> {
        return new Promise((resolve, reject) => {
            this._subscriptions.onSessionClosed = ServiceStreams.getSubjects().onSessionClosed.subscribe(this._onSessionClosed.bind(this));
            Promise.all([
                ServiceElectron.IPC.subscribe(IPCMessages.DLTDeamonConnectRequest, this._onDLTDeamonConnectRequest.bind(this)).then((subscription: Subscription) => {
                    this._subscriptions.DLTDeamonConnectRequest = subscription;
                }),
                ServiceElectron.IPC.subscribe(IPCMessages.DLTDeamonDisconnectRequest, this._onDLTDeamonDisconnectRequest.bind(this)).then((subscription: Subscription) => {
                    this._subscriptions.DLTDeamonDisconnectRequest = subscription;
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
        const connection: DLTConnectionController = new DLTConnectionController(
            req.id,
            req.session,
            {
                ecu: req.ecu,
                bindingAddress: req.bindingAddress,
                bindingPort: req.bindingPort,
                multicastInterface: req.multicastInterface,
                multicastAddress: req.multicastAddress,
            },
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
                response(
                    new IPCMessages.DLTDeamonConnectResponse({
                        id: req.id,
                        session: req.session,
                    }),
                );
                ServiceElectron.IPC.send(new IPCMessages.DLTDeamonConnectEvent({
                    id: req.id,
                    session: req.session,
                })).catch((error: Error) => {
                    this._logger.warn(`Fail to notify front-end about connection due error: ${error.message}`);
                });
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

}

export default new ServiceDLTDeamonConnector();
