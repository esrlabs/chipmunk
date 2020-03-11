import Logger from '../tools/env.logger';
import guid from '../tools/tools.guid';
import { IService } from '../interfaces/interface.service';
import ServiceElectron from './service.electron';
import { IPCMessages, Subscription } from './service.electron';

export type TTaskCloser = () => void;

/**
 * @class ServiceElectronState
 * @description Provides state of electron to render process
 */

class ServiceElectronState implements IService {

    private _logger: Logger = new Logger('ServiceElectronState');
    private _history: string[] = [];
    private _tasks: Map<string, string> = new Map();
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

    public destroy(): Promise<void> {
        return new Promise((resolve) => {
            resolve();
        });
    }

    public getName(): string {
        return 'ServiceElectronState';
    }

    public openTask(name: string): TTaskCloser {
        const taskId: string = guid();
        this._tasks.set(taskId, name);
        return this._closeTask.bind(this, taskId);
    }

    /**
     * Sends IPC message to render
     * @param {string} message message
     * @returns void
     */
    public logStateToRender(message: string): void {
        if (typeof message === 'string' && message.trim() !== '') {
            this._history.push(message);
        }
        if (!ServiceElectron.IPC.available()) {
            this._logger.debug(message);
        } else {
            ServiceElectron.IPC.send(new ServiceElectron.IPCMessages.HostState({
                message: message,
                state: this._isReadyState ? ServiceElectron.IPCMessages.HostState.States.ready : ServiceElectron.IPCMessages.HostState.States.working,
            })).catch((error: Error) => {
                this._logger.warn(`Fait to send IPC message "HostState" to render due: ${error.message}`);
            });
        }
    }

    /**
     * Sends IPC message to render to update current state of host
     * @returns void
     */
    public setStateAsBusy(): void {
        this._isReadyState = false;
        this._setState();
    }

    /**
     * Sends IPC message to render to update current state of host
     * @returns void
     */
    public setStateAsReady(): void {
        this._isReadyState = true;
        this._setState();
    }

    private _setState(): void {
        ServiceElectron.IPC.send(new ServiceElectron.IPCMessages.HostState({
            state: this._isReadyState ? ServiceElectron.IPCMessages.HostState.States.ready : ServiceElectron.IPCMessages.HostState.States.working,
        })).catch((error: Error) => {
            this._logger.warn(`Fait to send IPC message "HostState" to render due: ${error.message}`);
        });
    }

    private _closeTask(taskId: string) {
        this._tasks.delete(taskId);
    }

    /**
     * Handled event HostStateHistory from render and responce with history
     * @param {IPCMessages.HostStateHistory} message income message from render; will be empty
     * @returns void
     */
    private onHistoryOfHostStateRequested(message: IPCMessages.TMessage): any {
        ServiceElectron.IPC.send(new ServiceElectron.IPCMessages.HostStateHistory({
            history: this._history,
        })).catch((error: Error) => {
            this._logger.warn(`Fait to send IPC message "HostStateHistory" to render due: ${error.message}`);
        });
    }

    private onHostStateRequested(message: IPCMessages.TMessage, response: (instance: IPCMessages.TMessage) => any) {
        response(new ServiceElectron.IPCMessages.HostState({
            state: this._isReadyState ? ServiceElectron.IPCMessages.HostState.States.ready : ServiceElectron.IPCMessages.HostState.States.working,
        })).catch((error: Error) => {
            this._logger.warn(`Fait to send IPC message "HostState" to render due: ${error.message}`);
        });
    }

}

export default (new ServiceElectronState());
