import { unique } from '@platform/env/sequence';
import { Action } from '@platform/types/notification/index';

import * as Events from '@platform/ipc/event';

export interface INotification {
    message: string;
    session?: string;
    pinned?: boolean;
    actions: Action[];
}

export class Notification {
    static from(event: Events.Notification.Pop.Event): Notification {
        return new Notification({
            message: event.message,
            actions: event.actions,
            session: event.session,
            pinned: true,
        });
    }

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
