import { Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { Session } from '../controller/session/session';
import {
    INotification,
    ENotificationType,
    INotificationButton as IButton,
} from 'chipmunk.client.toolkit';
import { IPC, Subscription } from '../services/service.electron.ipc';

import ServiceElectronIpc from '../services/service.electron.ipc';

import * as Toolkit from 'chipmunk.client.toolkit';

import TabsSessionsService from '../services/service.sessions.tabs';

export { INotification, ENotificationType };

const CCloseDelay = {
    [ENotificationType.error]: 6000,
    [ENotificationType.warning]: 4000,
    [ENotificationType.accent]: 4000,
    [ENotificationType.info]: 2000,
};

type TSession = string;

@Injectable({ providedIn: 'root' })
export class NotificationsService {
    private subjects: {
        new: Subject<INotification>;
        updated: Subject<string>;
    } = {
        new: new Subject<INotification>(),
        updated: new Subject<string>(),
    };
    private _subscriptions: { [key: string]: Subscription } = {};
    private _onceHashes: Map<string, boolean> = new Map();
    private _storage: Map<TSession, INotification[]> = new Map();
    private _common: INotification[] = [];
    private _logger: Toolkit.Logger = new Toolkit.Logger('NotificationsService');

    constructor() {
        this._subscriptions.onProcessNotification = ServiceElectronIpc.subscribe(
            IPC.Notification,
            this._onProcessNotification.bind(this),
        );
        // Share notifications methods
        TabsSessionsService.setNotificationOpener(this.add.bind(this));
    }

    public destroy() {
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].destroy();
        });
    }

    public add(notification: INotification) {
        const notific: INotification | Error = this._validate(notification);
        if (notific instanceof Error) {
            this._logger.warn(`Fail to add notification due error: ${notific.message}`);
            return;
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
        new: Observable<INotification>;
        updated: Observable<string>;
    } {
        return {
            new: this.subjects.new.asObservable(),
            updated: this.subjects.updated.asObservable(),
        };
    }

    public get(session: TSession): INotification[] {
        const storage: INotification[] | undefined = this._storage.get(session);
        return storage === undefined
            ? ([] as INotification[]).concat(this._common, [])
            : ([] as INotification[]).concat(this._common, storage);
    }

    public getNotReadCount(session: TSession): number {
        let count: number = 0;
        const storage: INotification[] | undefined = this._storage.get(session);
        if (storage !== undefined) {
            storage.forEach((notification: INotification) => {
                count += notification.read !== true ? 1 : 0;
            });
        }
        this._common.forEach((notification: INotification) => {
            count += notification.read !== true ? 1 : 0;
        });
        return count;
    }

    public setAsRead(session: TSession, id: string) {
        const storage: INotification[] | undefined = this._storage.get(session);
        this._common = this._common.map((notification: INotification) => {
            if (notification.id === id) {
                notification.read = true;
            }
            return notification;
        });
        if (storage !== undefined) {
            this._storage.set(
                session,
                storage.map((notification: INotification) => {
                    if (notification.id === id) {
                        notification.read = true;
                    }
                    return notification;
                }),
            );
        }
        this.subjects.updated.next(session);
    }

    private _onProcessNotification(message: IPC.Notification) {
        const row: number | undefined =
            typeof message.row === 'string'
                ? parseInt(message.row, 10)
                : typeof message.row === 'number'
                ? message.row
                : undefined;
        const notification: INotification = {
            id: Toolkit.guid(),
            session: message.session !== '*' ? message.session : undefined,
            caption:
                message.caption.length > 150
                    ? `${message.caption.substr(0, 150)}...`
                    : message.caption,
            message:
                message.message.length > 1500
                    ? `${message.message.substr(0, 1500)}...`
                    : message.message,
            row:
                row === undefined
                    ? undefined
                    : isNaN(row)
                    ? undefined
                    : !isFinite(row)
                    ? undefined
                    : row,
            file: message.file,
            read: false,
            options: {
                type: message.type,
                closable: true,
            },
        };
        if (message.actions instanceof Array) {
            notification.buttons = this._actionsToButtons(message.actions);
        }
        this.add(notification);
    }

    private _validate(notification: INotification): INotification | Error {
        const active: Session | undefined = TabsSessionsService.getActive();
        if (notification.session !== undefined && active === undefined) {
            return new Error(`No any session.`);
        }
        notification.session =
            notification.session === undefined
                ? active === undefined
                    ? undefined
                    : active.getGuid()
                : notification.session;
        if (notification.options === undefined) {
            notification.options = {};
        }
        if (
            notification.options.type === undefined ||
            (CCloseDelay as any)[notification.options.type] === undefined
        ) {
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
        if (typeof notification.message !== 'string' || notification.message.trim() === '') {
            return;
        }
        if (notification.session === undefined) {
            this._common.push(notification);
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

    private _actionsToButtons(actions: IPC.INotificationAction[]): IButton[] {
        return actions
            .map((action: IPC.INotificationAction) => {
                switch (action.type) {
                    case IPC.ENotificationActionType.ipc:
                        return {
                            caption: action.caption,
                            handler: this._sendActionIPCMessage.bind(this, action.value),
                        };
                    case IPC.ENotificationActionType.close:
                        return {
                            caption: action.caption,
                            handler: () => {},
                        };
                    default:
                        return undefined;
                }
            })
            .filter((b) => b !== undefined) as IButton[];
    }

    private _sendActionIPCMessage(classname: string) {
        if ((IPC as any)[classname] === undefined) {
            return;
        }
        ServiceElectronIpc.send(new (IPC as any)[classname]());
    }
}
