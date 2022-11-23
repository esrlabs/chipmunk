import { SetupService, Interface, Implementation, register } from '@platform/entity/service';
import { ui } from '@register/services';
import { Notification } from './notification/notification';
import { Subject } from '@platform/env/subscription';
import { Level } from './notification/index';

import * as Events from '@platform/ipc/event';

export { Level, Notification };

@SetupService(ui['notifications'])
export class Service extends Implementation {
    public pop: Subject<Notification> = new Subject<Notification>();
    protected messages: Map<string, Notification> = new Map();

    public override ready(): Promise<void> {
        Events.IpcEvent.subscribe(
            Events.Notification.Pop.Event,
            (event: Events.Notification.Pop.Event) => {
                const notification = Notification.from(event);
                this.messages.set(notification.uuid, notification);
                this.pop.emit(notification);
            },
        );
        return Promise.resolve();
    }

    public notify(notification: Notification) {
        this.messages.set(notification.uuid, notification);
        this.pop.emit(notification);
    }

    public clear() {
        console.log(`... not implemented`);
    }
}
export interface Service extends Interface {}
export const notifications = register(new Service());
