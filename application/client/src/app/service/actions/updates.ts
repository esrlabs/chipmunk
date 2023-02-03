import { Base } from './action';
import { lockers, Locker } from '@ui/service/lockers';

import * as Requests from '@platform/ipc/request/index';

export const ACTION_UUID = 'check_updates_dialog';

export class Action extends Base {
    public group(): number {
        return 4;
    }
    public uuid(): string {
        return ACTION_UUID;
    }

    public caption(): string {
        return 'Check for Updates';
    }

    public async apply(): Promise<void> {
        const message = lockers.lock(new Locker(true, `Checking for updates...`), {
            closable: false,
        });
        Requests.IpcRequest.send(
            Requests.System.CheckUpdates.Response,
            new Requests.System.CheckUpdates.Request(),
        )
            .then((response) => {
                message.popup.close();
                lockers.lock(
                    new Locker(
                        false,
                        response.report !== undefined ? response.report : response.error,
                    ),
                    {
                        closable: true,
                    },
                );
            })
            .catch((err: Error) => {
                lockers.lock(new Locker(false, err.message), {
                    closable: true,
                });
            });
    }
}
