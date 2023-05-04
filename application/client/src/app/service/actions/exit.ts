import { Base } from './action';
import { lockers, Locker } from '@ui/service/lockers';

import * as Requests from '@platform/ipc/request/index';

export const ACTION_UUID = 'exit_from_application';

export class Action extends Base {
    public group(): number {
        return 4;
    }
    public uuid(): string {
        return ACTION_UUID;
    }

    public caption(): string {
        return 'Exit';
    }

    public async apply(): Promise<void> {
        const message = lockers.lock(new Locker(true, `Closing...`), {
            closable: false,
        });
        Requests.IpcRequest.send(Requests.System.Exit.Response, new Requests.System.Exit.Request())
            .then((_response) => {
                message.popup.close();
            })
            .catch((err: Error) => {
                lockers.lock(new Locker(false, err.message), {
                    closable: true,
                });
            });
    }
}
