import { CancelablePromise } from 'platform/env/promise';
import { sessions } from '@service/sessions';
import { Instance as Logger } from 'platform/env/logger';

import * as Requests from 'platform/ipc/request';

export const handler = Requests.InjectLogger<
    Requests.Session.ExportRaw.Request,
    CancelablePromise<Requests.Session.ExportRaw.Response>
>(
    (
        log: Logger,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        request: Requests.Session.ExportRaw.Request,
    ): CancelablePromise<Requests.Session.ExportRaw.Response> => {
        return new CancelablePromise<Requests.Session.ExportRaw.Response>((resolve, reject) => {
            const session_uuid = request.session;
            const stored = sessions.get(session_uuid);
            if (stored === undefined) {
                return reject(new Error(`Session doesn't exist`));
            }
            stored.session
                .getStream()
                .exportRaw(request.dest, request.ranges)
                .then((complete) => {
                    resolve(
                        new Requests.Session.ExportRaw.Response({
                            complete,
                        }),
                    );
                })
                .catch((err: Error) => {
                    resolve(
                        new Requests.Session.ExportRaw.Response({
                            complete: false,
                            error: err.message,
                        }),
                    );
                });
        });
    },
);
