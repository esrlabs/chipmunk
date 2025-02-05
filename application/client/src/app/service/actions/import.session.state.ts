import { Base } from './action';
import { session } from '@service/session';
import { bridge } from '@service/bridge';
import { Notification, notifications } from '@ui/service/notifications';

export const ACTION_UUID = 'import_session_state';

export class Action extends Base {
    public group(): number {
        return 4;
    }
    public uuid(): string {
        return ACTION_UUID;
    }

    public caption(): string {
        return 'Import Filters';
    }

    public async apply(): Promise<void> {
        const active = session.active().session();
        if (active === undefined) {
            return;
        }
        const files = await bridge.files().select.any();
        if (files.length !== 1) {
            return Promise.resolve();
        }
        bridge
            .files()
            .read(files[0].filename)
            .then((content: string) => {
                const err = active.snap().load(content);
                if (err instanceof Error) {
                    return Promise.reject(err);
                }
                return undefined;
            })
            .catch((err: Error) => {
                notifications.notify(
                    new Notification({
                        message: `Import failed with: ${err.message}`,
                        actions: [],
                    }),
                );
            });
    }
}
