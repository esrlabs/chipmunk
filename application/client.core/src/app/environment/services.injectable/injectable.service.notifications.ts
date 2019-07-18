import { Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import ServiceElectronIpc, { IPCMessages, Subscription } from '../services/service.electron.ipc';
import * as Toolkit from 'logviewer.client.toolkit';

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
    private _onceHashes: Map<string, boolean> = new Map();

    constructor() {
        this._subscriptions.onProcessNotification = ServiceElectronIpc.subscribe(IPCMessages.Notification, this._onProcessNotification.bind(this));
    }

    destroy() {
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].destroy();
        });
    }

    add(notification: INotification) {
        if (this._isIgnored(notification)) {
            return;
        }
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
}
