import { IService } from '../interfaces/interface.service';
import { INotification, Notification, ENotificationType, INotificationAction, ENotificationActionType } from '../../../ipc/electron.ipc.messages/index';
import ServiceElectron from './service.electron';
import Logger from '../tools/env.logger';

export { INotification, Notification, ENotificationType, INotificationAction, ENotificationActionType };

/**
 * @class ServiceNotifications
 * @description Sender of notifications to client (render/front-end)
 */

class ServiceNotifications implements IService {

    private _logger: Logger = new Logger('ServiceNotifications');
    private _locked: boolean = false;
    /**
     * Initialization function
     * @returns Promise<void>
     */
    public init(): Promise<void> {
        return new Promise((resolve) => {
            resolve();
        });
    }

    public destroy(): Promise<void> {
        return new Promise((resolve) => {
            this._locked = true;
            resolve();
        });
    }

    public getName(): string {
        return 'ServiceNotifications';
    }

    /**
     * Sends notification to client (render)
     * @param {INotification} notification - body of notification
     * {
     *      message: string;
     *      caption: string;
     *      session?: string;
     *      file?: string;
     *      row?: number;
     *      data?: any;
     *      type?: ENotificationType | string;
     *      actions?: INotificationAction[];
     * }
     * @param {string} session - related session
     * @returns {Error | undefined}
     */
    public notify(notification: INotification, session?: string): Error | undefined {
        if (this._locked) {
            return new Error(this._logger.warn(`Cannot send notification "${notification.caption}" because notification service is locked`));
        }
        if (typeof session === 'string' && notification.session === undefined) {
            notification.session = session;
        }
        ServiceElectron.IPC.send(new Notification(notification)).catch((error: Error) => {
            this._logger.error(`Fail to send notification due error: ${error.message}`);
        });
    }

}

export default (new ServiceNotifications());
