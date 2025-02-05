import { Base } from './action';
import { session } from '@service/session';
import { bridge } from '@service/bridge';
import { Notification, notifications } from '@ui/service/notifications';

export const ACTION_UUID = 'export_session_state';

export class Action extends Base {
    public group(): number {
        return 4;
    }
    public uuid(): string {
        return ACTION_UUID;
    }

    public caption(): string {
        return 'Export Current Filters';
    }

    public async apply(): Promise<void> {
        const active = session.active().session();
        if (active === undefined) {
            return;
        }
        const snap = active.snap().get();
        const filename = await bridge.files().select.save('state', undefined);
        if (filename === undefined) {
            return Promise.resolve();
        }
        bridge
            .files()
            .write(filename, snap, true)
            .catch((err: Error) => {
                notifications.notify(
                    new Notification({
                        message: `Export failed with: ${err.message}`,
                        actions: [],
                    }),
                );
            });
    }
}
