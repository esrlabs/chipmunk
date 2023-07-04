import { SetupService, Interface, Implementation, register } from '@platform/entity/service';
import { ui } from '@register/services';
import { Notification } from './notification/notification';
import { Subject, Subjects } from '@platform/env/subscription';
import { Level } from './notification/index';

import * as Events from '@platform/ipc/event';

export { Level, Notification };

@SetupService(ui['notifications'])
export class Service extends Implementation {
    public subjects: Subjects<{
        pop: Subject<Notification>;
        store: Subject<Notification>;
    }> = new Subjects({
        pop: new Subject<Notification>(),
        store: new Subject<Notification>(),
    });

    protected messages: Map<string, Notification> = new Map();

    public override ready(): Promise<void> {
        Events.IpcEvent.subscribe(
            Events.Notification.Pop.Event,
            (event: Events.Notification.Pop.Event) => {
                const notification = Notification.from(event);
                this.messages.set(notification.uuid, notification);
                this.subjects.get().pop.emit(notification);
            },
        );
        return Promise.resolve();
    }

    public notify(notification: Notification): Service {
        this.store(notification).subjects.get().pop.emit(notification);
        return this;
    }

    public store(notification: Notification): Service {
        this.messages.set(notification.uuid, notification);
        this.subjects.get().store.emit(notification);
        return this;
    }

    public clear() {
        console.log(`... not implemented`);
    }
}
export interface Service extends Interface {}
export const notifications = register(new Service());
