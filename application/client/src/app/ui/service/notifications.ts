import { SetupService, Interface, Implementation, register } from '@platform/entity/service';
import { ui } from '@register/services';
import { Notification } from './notification/index';
import { Subject } from '@platform/env/subscription';

@SetupService(ui['notifications'])
export class Service extends Implementation {
    public pop: Subject<Notification> = new Subject<Notification>();
    protected messages: Map<string, Notification> = new Map();

    public add(notification: Notification) {
        this.messages.set(notification.uuid, notification);
        this.pop.emit(notification);
    }

    public clear() {
        console.log(`... not implemented`);
    }
}
export interface Service extends Interface {}
export const notifications = register(new Service());
