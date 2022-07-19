import { unique } from '@platform/env/sequence';
import { Action } from '@platform/types/notification/index';

export enum ENotificationType {
    info = 'info',
    error = 'error',
    warning = 'warning',
    accent = 'accent',
}

export interface INotification {
    message: string;
    pinned?: boolean;
    actions: Action[];
}

export class Notification {
    public readonly notification: INotification;
    public readonly uuid: string = unique();

    constructor(notification: INotification) {
        this.notification = notification;
    }

    public actions(): Action[] {
        return this.notification.actions;
    }

    public message(): string {
        return this.notification.message;
    }

    public duration(): number | undefined {
        return this.notification.pinned === true ? undefined : 3000;
    }
}
