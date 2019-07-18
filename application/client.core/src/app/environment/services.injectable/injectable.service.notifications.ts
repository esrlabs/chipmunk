import { Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import ServiceElectronIpc, { IPCMessages, Subscription } from '../services/service.electron.ipc';

export enum ENotificationType {
    info = 'info',
    error = 'error',
    warning = 'warning',
}

export interface IOptions {
    closeDelay?: number;
    closable?: boolean;
    type?: ENotificationType;
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
    id?: string;
    caption: string;
    message?: string;
    component?: IComponent;
    progress?: boolean;
    buttons?: IButton[];
    options?: IOptions;
    closing?: boolean;
}

@Injectable({ providedIn: 'root' })

export class NotificationsService {

    private subject = new Subject<INotification>();
    private _subscriptions: { [key: string]: Subscription } = {};

    constructor() {
        this._subscriptions.onProcessNotification = ServiceElectronIpc.subscribe(IPCMessages.Notification, this._onProcessNotification.bind(this));
    }

    destroy() {
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].destroy();
        });
    }

    add(notification: INotification) {
        this.subject.next(notification);
    }

    clear() {
        this.subject.next();
    }

    getObservable(): Observable<INotification> {
        return this.subject.asObservable();
    }

    private _onProcessNotification(message: IPCMessages.Notification) {
        this.add({
            caption: message.caption.length > 150 ? `${message.caption.substr(0, 150)}...` : message.caption,
            message: message.message.length > 1500 ? `${message.message.substr(0, 1500)}...` : message.message,
            options: {
                type: message.type,
                closeDelay: message.type === ENotificationType.info ? undefined : Infinity,
                closable: true,
            }
        });
    }
}
