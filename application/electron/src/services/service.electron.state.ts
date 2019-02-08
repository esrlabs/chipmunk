import Logger from '../../platform/node/src/env.logger';

import { IService } from '../interfaces/interface.service';
import ServiceElectron from './service.electron';
import { IPCMessages, Subscription } from './service.electron';

/**
 * @class ServiceElectronService
 * @description Provides state of electron to render process
 */

class ServiceElectronService implements IService {

    private _logger: Logger = new Logger('ServiceElectronService');
    private _history: string[] = [];
    private _isReadyState: boolean = false;
    private _subscriptions: { [key: string]: Subscription | undefined } = {
        history: undefined,
        state: undefined,
    };

    constructor() {
        this.onHistoryOfHostStateRequested = this.onHistoryOfHostStateRequested.bind(this);
        this.onHostStateRequested = this.onHostStateRequested.bind(this);
    }

    /**
     * Initialization function
     * @returns Promise<void>
     */
    public init(): Promise<void> {
        return new Promise((resolve) => {
            Promise.all([
                ServiceElectron.IPC.subscribe(IPCMessages.HostStateHistory, this.onHistoryOfHostStateRequested).then((subscription: Subscription) => {
                    this._subscriptions.history = subscription;
                }).catch((error: Error) => {
                    this._logger.warn(`Fail to subscribe to render event "HostStateHistory" due error: ${error.message}. This is not blocked error, loading will be continued.`);
                }),
                ServiceElectron.IPC.subscribe(IPCMessages.HostState, this.onHostStateRequested).then((subscription: Subscription) => {
                    this._subscriptions.state = subscription;
                }).catch((error: Error) => {
                    this._logger.warn(`Fail to subscribe to render event "HostState" due error: ${error.message}. This is not blocked error, loading will be continued.`);
                }),
            ]).then(() => {
                resolve();
            }).catch((error: Error) => {
                this._logger.warn(`Fail to subscribe due error: ${error.message}. This is not blocked error, loading will be continued.`);
                resolve();
            });

        });
    }

    public getName(): string {
        return 'ServiceElectronService';
    }

    /**
     * Sends IPC message to render to update current state of host
     * @param {string} message message
     * @param {boolean} isReady ready flag
     * @returns void
     */
    public updateHostState(message: string, isReady: boolean = false): void {
        if (typeof message === 'string' && message.trim() !== '') {
            this._history.push(message);
        }
        this._isReadyState = isReady;
        ServiceElectron.IPC.send(ServiceElectron.IPCMessages.HostState, new ServiceElectron.IPCMessages.HostState({
            message: message,
            state: isReady ? ServiceElectron.IPCMessages.HostState.States.ready : ServiceElectron.IPCMessages.HostState.States.working,
        })).catch((error: Error) => {
            this._logger.warn(`Fait to send IPC message "HostState" to render due: ${error.message}`);
        });
    }

    /**
     * Handled event HostStateHistory from render and responce with history
     * @param {IPCMessages.HostStateHistory} message income message from render; will be empty
     * @returns void
     */
    private onHistoryOfHostStateRequested(message: IPCMessages.TMessage): any {
        ServiceElectron.IPC.send(ServiceElectron.IPCMessages.HostStateHistory, new ServiceElectron.IPCMessages.HostStateHistory({
            history: this._history,
        })).catch((error: Error) => {
            this._logger.warn(`Fait to send IPC message "HostStateHistory" to render due: ${error.message}`);
        });
    }

    private onHostStateRequested(message: IPCMessages.TMessage) {
        ServiceElectron.IPC.send(ServiceElectron.IPCMessages.HostState, new ServiceElectron.IPCMessages.HostState({
            state: this._isReadyState ? ServiceElectron.IPCMessages.HostState.States.ready : ServiceElectron.IPCMessages.HostState.States.working,
        })).catch((error: Error) => {
            this._logger.warn(`Fait to send IPC message "HostState" to render due: ${error.message}`);
        });
    }

}

export default (new ServiceElectronService());
