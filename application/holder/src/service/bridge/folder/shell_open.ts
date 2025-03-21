import { CancelablePromise } from 'platform/env/promise';
import { Logger } from 'platform/log';
import { shell } from 'electron';

import * as Requests from 'platform/ipc/request';

export const handler = Requests.InjectLogger<
    Requests.Folder.ShellOpen.Request,
    CancelablePromise<Requests.Folder.ShellOpen.Response>
>(
    (
        _log: Logger,
        request: Requests.Folder.ShellOpen.Request,
    ): CancelablePromise<Requests.Folder.ShellOpen.Response> => {
        return new CancelablePromise((resolve, reject) => {
            shell
                .openPath(request.path)
                .then(() => {
                    resolve(new Requests.Folder.ShellOpen.Response());
                })
                .catch(reject);
        });
    },
);
