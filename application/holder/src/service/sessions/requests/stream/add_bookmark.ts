import { CancelablePromise } from 'platform/env/promise';
import { sessions } from '@service/sessions';
import { Logger } from 'platform/log';

import * as Requests from 'platform/ipc/request';

export const handler = Requests.InjectLogger<
    Requests.Stream.AddBookmark.Request,
    CancelablePromise<Requests.Stream.AddBookmark.Response>
>(
    (
        _log: Logger,
        request: Requests.Stream.AddBookmark.Request,
    ): CancelablePromise<Requests.Stream.AddBookmark.Response> => {
        return new CancelablePromise((resolve, reject) => {
            const stored = sessions.get(request.session);
            if (stored === undefined) {
                return reject(new Error(`Session doesn't exist`));
            }
            stored.session
                .getStream()
                .addBookmark(request.row)
                .then(() => {
                    resolve(
                        new Requests.Stream.AddBookmark.Response({
                            session: stored.session.getUUID(),
                        }),
                    );
                })
                .catch((err: Error) => {
                    resolve(
                        new Requests.Stream.AddBookmark.Response({
                            session: stored.session.getUUID(),
                            error: err.message,
                        }),
                    );
                });
        });
    },
);
