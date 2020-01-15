import ServiceElectron, { IPCMessages } from "../service.electron";
import Logger from "../../tools/env.logger";
import * as Tools from "../../tools/index";
import { Subscription } from "../../tools/index";
import { IService } from "../../interfaces/interface.service";
import indexer, { Progress, DLT, CancelablePromise } from "indexer-neon";
import ServiceStreams from "../service.streams";
import ServiceStreamSource from '../service.stream.sources';
import { DLTConnectionController } from '../../controllers/connections/dlt.connection';

/**
 * @class ServiceDLTDeamonConnector
 * @description Providers access to DLT deamon (UPD)
 */

class ServiceDLTDeamonConnector implements IService {

    private _logger: Logger = new Logger("ServiceDLTDeamonConnector");
    // Should detect by executable file
    private _subscription: { [key: string]: Subscription } = {};
    private _connections: Map<string, DLTConnectionController> = new Map();

    /**
     * Initialization function
     * @returns Promise<void>
     */
    public init(): Promise<void> {
        return new Promise((resolve, reject) => {
            Promise.all([
                ServiceElectron.IPC.subscribe(IPCMessages.DLTDeamonConnectRequest, this._onDLTDeamonConnectRequest.bind(this)).then((subscription: Subscription) => {
                    this._subscription.DLTDeamonConnectRequest = subscription;
                }),
                ServiceElectron.IPC.subscribe(IPCMessages.DLTDeamonDisconnectRequest, this._onDLTDeamonDisconnectRequest.bind(this)).then((subscription: Subscription) => {
                    this._subscription.DLTDeamonDisconnectRequest = subscription;
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
            req.session,
            {
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
                this._logger.info(`connected`);
                state.connected = true;
            });
            // Listen disconnect event
            connection.once(DLTConnectionController.Events.disconnect, () => {
                this._logger.info(`disconnected`);
                connection.removeAllListeners();
                this._connections.delete(req.session);
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
}

export default new ServiceDLTDeamonConnector();
