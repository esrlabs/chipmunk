import { SetupService, Interface, Implementation, register } from '@platform/entity/service';
import { ui } from '@register/services';
import { ilc, Emitter } from '@service/ilc';
import { IComponentDesc } from '@elements/containers/dynamic/component';

export enum ENotificationType {
    info = 'info',
    error = 'error',
    warning = 'warning',
    accent = 'accent',
}

export interface INotificationOptions {
    closeDelay?: number;
    closable?: boolean;
    type?: ENotificationType;
    once?: boolean;
}

export interface INotificationButton {
    caption: string;
    handler: (...args: any[]) => any;
}

export interface INotification {
    session?: string;
    id?: string;
    caption: string;
    row?: number;
    file?: string;
    message?: string;
    buttons?: INotificationButton[];
    options?: INotificationOptions;
    read?: boolean;
    component?: IComponentDesc;
    closing?: boolean;
    progress?: boolean;
}

@SetupService(ui['notifications'])
export class Service extends Implementation {
    private _emitter: Emitter | undefined;

    public override ready(): Promise<void> {
        this._emitter = ilc.emitter(ui['notifications'].name, this.log());
        return Promise.resolve();
    }

    public add(notification: INotification) {
        console.log(notification);
    }

    public clear() {
        console.log(`... not implemented`);
    }
}
export interface Service extends Interface {}
export const notifications = register(new Service());
