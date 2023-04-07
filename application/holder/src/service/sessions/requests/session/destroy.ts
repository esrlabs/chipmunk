import { CancelablePromise } from 'platform/env/promise';
import { sessions } from '@service/sessions';
import { Logger } from 'platform/log';

import * as Requests from 'platform/ipc/request';

export const handler = Requests.InjectLogger<
    Requests.Session.Destroy.Request,
    CancelablePromise<Requests.Session.Destroy.Response>
>(
    (
        log: Logger,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        request: Requests.Session.Destroy.Request,
    ): CancelablePromise<Requests.Session.Destroy.Response> => {
        return new CancelablePromise<Requests.Session.Destroy.Response>((resolve, reject) => {
            const session_uuid = request.session;
            const stored = sessions.get(session_uuid);
            if (stored === undefined) {
                return reject(new Error(`Session doesn't exist`));
            }
            if (stored.isShutdowning()) {
                return resolve(
                    new Requests.Session.Destroy.Response({
                        session: session_uuid,
                    }),
                );
            } else {
                stored
                    .destroy()
                    .then(() => {
                        sessions.delete(session_uuid);
                        resolve(
                            new Requests.Session.Destroy.Response({
                                session: session_uuid,
                            }),
                        );
                    })
                    .catch((err: Error) => {
                        resolve(
                            new Requests.Session.Destroy.Response({
                                session: session_uuid,
                                error: err.message,
                            }),
                        );
                    });
            }
        });
    },
);
