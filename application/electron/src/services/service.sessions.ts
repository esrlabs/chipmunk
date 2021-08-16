import Logger from '../tools/env.logger';
import { IService } from '../interfaces/interface.service';
import ServiceElectron, { IPCMessages, Subscription } from './service.electron';

/**
 * @class ServiceSessions
 * @description Just keep information about sessions
 */

class ServiceSessions implements IService {

    private _logger: Logger = new Logger('ServiceSessions');
    private _subscriptions: { [key: string ]: Subscription | undefined } = { };
    private _isSession: boolean = false;

    public get isSession(): boolean {
        return this._isSession;
    }

    /**
     * Initialization function
     * @returns Promise<void>
     */
    public init(): Promise<void> {
        return new Promise((resolve, reject) => {
            ServiceElectron.IPC.subscribe(IPCMessages.SessionChange, this._ipc_onSessionChange.bind(this)).then((subscription: Subscription) => {
                this._subscriptions.SessionChange = subscription;
            }).catch((error: Error) => {
                this._logger.warn(`Fail to subscribe to render event "SessionChange" due error: ${error.message}. This is not blocked error, loading will be continued.`);
            });
            resolve();
        });
    }

    public destroy(): Promise<void> {
        return new Promise((resolve) => {
            resolve();
        });
    }

    public getName(): string {
        return 'ServiceSessions';
    }

    private _ipc_onSessionChange(message: IPCMessages.TMessage) {
        if (!(message instanceof IPCMessages.SessionChange)) {
            return;
        }
        this._isSession = message.isSession;
        ServiceElectron.updateMenu();
    }

}

export default (new ServiceSessions());
