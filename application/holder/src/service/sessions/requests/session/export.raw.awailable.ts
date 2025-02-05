import { CancelablePromise } from 'platform/env/promise';
import { sessions } from '@service/sessions';
import { Logger } from 'platform/log';

import * as Requests from 'platform/ipc/request';

export const handler = Requests.InjectLogger<
    Requests.Session.IsExportRawAvailable.Request,
    CancelablePromise<Requests.Session.IsExportRawAvailable.Response>
>(
    (
        _log: Logger,
        request: Requests.Session.IsExportRawAvailable.Request,
    ): CancelablePromise<Requests.Session.IsExportRawAvailable.Response> => {
        return new CancelablePromise<Requests.Session.IsExportRawAvailable.Response>(
            (resolve, reject) => {
                const session_uuid = request.session;
                const stored = sessions.get(session_uuid);
                if (stored === undefined) {
                    return reject(new Error(`Session doesn't exist`));
                }
                stored.session
                    .isRawExportAvailable()
                    .then((available) => {
                        resolve(
                            new Requests.Session.IsExportRawAvailable.Response({
                                available,
                                error: undefined,
                            }),
                        );
                    })
                    .catch((err: Error) => {
                        resolve(
                            new Requests.Session.IsExportRawAvailable.Response({
                                available: false,
                                error: err.message,
                            }),
                        );
                    });
            },
        );
    },
);
