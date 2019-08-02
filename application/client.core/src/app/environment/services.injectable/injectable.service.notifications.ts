import { Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import ServiceElectronIpc, { IPCMessages, Subscription } from '../services/service.electron.ipc';
import * as Toolkit from 'logviewer.client.toolkit';
import TabsSessionsService from '../services/service.sessions.tabs';

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
    message?: string;
    component?: IComponent;
    progress?: boolean;
    buttons?: IButton[];
    options?: IOptions;
    closing?: boolean;
}

const CCloseDelay = {
    [ENotificationType.error]: 4000,
    [ENotificationType.warning]: 3000,
    [ENotificationType.info]: 2000,
};

type TSession = string;

@Injectable({ providedIn: 'root' })

export class NotificationsService {

    private subject = new Subject<INotification>();
    private _subscriptions: { [key: string]: Subscription } = {};
    private _onceHashes: Map<string, boolean> = new Map();
    private _storage: Map<TSession, INotification[]> = new Map();

    constructor() {
        this._subscriptions.onProcessNotification = ServiceElectronIpc.subscribe(IPCMessages.Notification, this._onProcessNotification.bind(this));
    }

    public destroy() {
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].destroy();
        });
    }

    public add(notification: INotification) {
        notification = this._validate(notification);
        this._store(notification);
        if (this._isIgnored(notification)) {
            return;
        }
        this.subject.next(notification);
    }

    public clear(session: TSession) {
        this._storage.delete(session);
    }

    public getObservable(): Observable<INotification> {
        return this.subject.asObservable();
    }

    public get(session: TSession): INotification[] {
        const storage: INotification[] | undefined = this._storage.get(session);
        return storage === undefined ? [] : storage;
    }

    private _onProcessNotification(message: IPCMessages.Notification) {
        this.add({
            caption: message.caption.length > 150 ? `${message.caption.substr(0, 150)}...` : message.caption,
            message: message.message.length > 1500 ? `${message.message.substr(0, 1500)}...` : message.message,
            options: {
                type: message.type,
                closable: true,
            }
        });
    }

    private _validate(notification: INotification): INotification {
        notification.session = notification.session === undefined ? TabsSessionsService.getActive().getGuid() : notification.session;
        if (notification.options === undefined) {
            notification.options = {};
        }
        if (CCloseDelay[notification.options.type] === undefined) {
            notification.options.type = ENotificationType.info;
        }
        notification.options.closeDelay = CCloseDelay[notification.options.type];
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

}
