import { electron } from '@service/electron';
import { CancelablePromise } from 'platform/env/promise';
import { Logger } from 'platform/log';

import * as Requests from 'platform/ipc/request';

export const handler = Requests.InjectLogger<
    Requests.File.Save.Request,
    CancelablePromise<Requests.File.Save.Response>
>(
    (
        log: Logger,
        request: Requests.File.Save.Request,
    ): CancelablePromise<Requests.File.Save.Response> => {
        return new CancelablePromise((resolve) => {
            electron
                .dialogs()
                .saveFile(request.ext)
                .then((file: string | undefined) => {
                    resolve(
                        new Requests.File.Save.Response({
                            filename: file,
                            error: undefined,
                        }),
                    );
                })
                .catch((err: Error) => {
                    resolve(
                        new Requests.File.Save.Response({
                            filename: undefined,
                            error: err.message,
                        }),
                    );
                });
        });
    },
);
