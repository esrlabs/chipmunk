import { Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import ServiceElectronIpc, { IPCMessages, Subscription } from '../services/service.electron.ipc';
import * as Toolkit from 'chipmunk.client.toolkit';
import TabsSessionsService from '../services/service.sessions.tabs';
import { ControllerSessionTab } from '../controller/controller.session.tab';

export enum ENotificationType {
    info = 'info',
    error = 'error',
    warning = 'warning',
}

export interface IOptions {
    closeDelay?: number;
    closable?: boolean;
    type?: ENotificationType;
    once?: boolean;
}

export interface IButton {
    caption: string;
    handler: (...args: any[]) => any;
}

export interface IComponent {
    factory: any;
    inputs: any;
}

export interface INotification {
    session?: string;
    id?: string;
    caption: string;
    row?: number;
    file?: string;
    message?: string;
    component?: IComponent;
    progress?: boolean;
    buttons?: IButton[];
    options?: IOptions;
    closing?: boolean;
    read?: boolean;
}

const CCloseDelay = {
    [ENotificationType.error]: 4000,
    [ENotificationType.warning]: 3000,
    [ENotificationType.info]: 2000,
};

type TSession = string;

@Injectable({ providedIn: 'root' })

export class NotificationsService {

    private subjects: {
        new: Subject<INotification>,
        updated: Subject<string>,
    } = {
        new: new Subject<INotification>(),
        updated: new Subject<string>(),
    };
    private _subscriptions: { [key: string]: Subscription } = {};
    private _onceHashes: Map<string, boolean> = new Map();
    private _storage: Map<TSession, INotification[]> = new Map();
    private _logger: Toolkit.Logger = new Toolkit.Logger('NotificationsService');

    constructor() {
        this._subscriptions.onProcessNotification = ServiceElectronIpc.subscribe(IPCMessages.Notification, this._onProcessNotification.bind(this));
    }

    public destroy() {
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].destroy();
        });
    }

    public add(notification: INotification) {
        const notific: INotification | Error = this._validate(notification);
        if (notific instanceof Error) {
            return this._logger.warn(`Fail to add notification due error: ${notific.message}`);
        }
        this._store(notific);
        if (this._isIgnored(notific)) {
            return;
        }
        this.subjects.new.next(notific);
    }

    public clear(session: TSession) {
        this._storage.delete(session);
        this.subjects.updated.next(session);
    }

    public getObservable(): {
        new: Observable<INotification>,
        updated: Observable<string>
    } {
        return {
            new: this.subjects.new.asObservable(),
            updated: this.subjects.updated.asObservable(),
        };
    }

    public get(session: TSession): INotification[] {
        const storage: INotification[] | undefined = this._storage.get(session);
        return storage === undefined ? [] : storage;
    }

    public getNotReadCount(session: TSession): number {
        const storage: INotification[] | undefined = this._storage.get(session);
        if (storage === undefined) {
            return -1;
        }
        let count: number = 0;
        storage.forEach((notification: INotification) => {
            count += (notification.read !== true ? 1 : 0);
        });
        return count;
    }

    public setAsRead(session: TSession, id: string) {
        const storage: INotification[] | undefined = this._storage.get(session);
        if (storage === undefined) {
            return;
        }
        this._storage.set(session, storage.map((notification: INotification) => {
            if (notification.id === id) {
                notification.read = true;
            }
            return notification;
        }));
        this.subjects.updated.next(session);
    }

    private _onProcessNotification(message: IPCMessages.Notification) {
        const row: number | undefined = typeof message.row === 'string' ? parseInt(message.row, 10) : (typeof message.row === 'number' ? message.row : undefined);
        const notification: INotification = {
            id: Toolkit.guid(),
            caption: message.caption.length > 150 ? `${message.caption.substr(0, 150)}...` : message.caption,
            message: message.message.length > 1500 ? `${message.message.substr(0, 1500)}...` : message.message,
            row: isNaN(row) ? undefined : (!isFinite(row) ? undefined : row),
            file: message.file,
            read: false,
            options: {
                type: message.type,
                closable: true,
            }
        };
        if (message.actions instanceof Array) {
            notification.buttons = this._actionsToButtons(message.actions);
        }
        this.add(notification);
    }

    private _validate(notification: INotification): INotification | Error {
        const active: ControllerSessionTab | undefined = TabsSessionsService.getActive();
        if (notification.session === undefined && active === undefined) {
            return new Error(`No any session.`);
        }
        notification.session = notification.session === undefined ? active.getGuid() : notification.session;
        if (notification.options === undefined) {
            notification.options = {};
        }
        if (CCloseDelay[notification.options.type] === undefined) {
            notification.options.type = ENotificationType.info;
        }
        notification.options.closeDelay = CCloseDelay[notification.options.type];
        notification.read = false;
        if (notification.id === undefined) {
            notification.id = Toolkit.guid();
        }
        return notification;
    }

    private _isIgnored(notification: INotification): boolean {
        if (notification.options === undefined) {
            return false;
        }
        if (notification.options.once !== true) {
            return false;
        }
        const hash: string = Toolkit.hash(notification.caption + notification.message);
        if (this._onceHashes.has(hash)) {
            return true;
        }
        this._onceHashes.set(hash, true);
        return false;
    }

    private _store(notification: INotification) {
        if (notification.progress) {
            return;
        }
        if (typeof notification.message !== 'string' || notification.message.trim() === '') {
            return;
        }
        if (notification.session === undefined) {
            this._storage.forEach((storage: INotification[], session: TSession) => {
                storage.push(notification);
                this._storage.set(session, storage);
            });
        } else {
            let stored: INotification[] | undefined = this._storage.get(notification.session);
            if (stored === undefined) {
                stored = [notification];
            } else {
                stored.push(notification);
            }
            this._storage.set(notification.session, stored);
        }
    }

    private _actionsToButtons(actions: IPCMessages.INotificationAction[]): IButton[] {
        return actions.map((action: IPCMessages.INotificationAction) => {
            switch (action.type) {
                case IPCMessages.ENotificationActionType.ipc:
                    return {
                        caption: action.caption,
                        handler: this._sendActionIPCMessage.bind(this, action.value),
                    };
                case IPCMessages.ENotificationActionType.close:
                    return {
                        caption: action.caption,
                        handler: () => { },
                    };
                default:
                    return undefined;
            }
        }).filter( b => b !== undefined);
    }

    private _sendActionIPCMessage(classname: string) {
        if (IPCMessages[classname] === undefined) {
            return;
        }
        ServiceElectronIpc.send(new IPCMessages[classname]());
    }

}
