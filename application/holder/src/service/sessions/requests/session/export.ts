import { CancelablePromise } from 'platform/env/promise';
import { sessions } from '@service/sessions';
import { Logger } from 'platform/log';

import * as Requests from 'platform/ipc/request';

export const handler = Requests.InjectLogger<
    Requests.Session.Export.Request,
    CancelablePromise<Requests.Session.Export.Response>
>(
    (
        log: Logger,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        request: Requests.Session.Export.Request,
    ): CancelablePromise<Requests.Session.Export.Response> => {
        return new CancelablePromise<Requests.Session.Export.Response>((resolve, reject) => {
            const session_uuid = request.session;
            const stored = sessions.get(session_uuid);
            if (stored === undefined) {
                return reject(new Error(`Session doesn't exist`));
            }
            stored.session
                .getStream()
                .export(request.dest, request.ranges)
                .then((complete) => {
                    resolve(
                        new Requests.Session.Export.Response({
                            complete,
                        }),
                    );
                })
                .catch((err: Error) => {
                    resolve(
                        new Requests.Session.Export.Response({
                            complete: false,
                            error: err.message,
                        }),
                    );
                });
        });
    },
);
