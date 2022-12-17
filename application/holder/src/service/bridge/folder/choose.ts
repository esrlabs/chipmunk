import { CancelablePromise } from 'platform/env/promise';
import { Instance as Logger } from 'platform/env/logger';
import { electron } from '@service/electron';

import * as Requests from 'platform/ipc/request';

export const handler = Requests.InjectLogger<
    Requests.Folder.Choose.Request,
    CancelablePromise<Requests.Folder.Choose.Response>
>(
    (
        log: Logger,
        request: Requests.Folder.Choose.Request,
    ): CancelablePromise<Requests.Folder.Choose.Response> => {
        return new CancelablePromise((resolve, reject) => {
            electron
                .dialogs()
                .openFolder()
                .then((paths: string[]) => {
                    resolve(
                        new Requests.Folder.Choose.Response({
                            paths,
                        }),
                    );
                })
                .catch(reject);
        });
    },
);
