import { CancelablePromise } from 'platform/env/promise';
import { sessions } from '@service/sessions';
import { Instance as Logger } from 'platform/env/logger';

import * as Requests from 'platform/ipc/request';

export const handler = Requests.InjectLogger<
    Requests.Stream.IndexesAround.Request,
    CancelablePromise<Requests.Stream.IndexesAround.Response>
>(
    (
        _log: Logger,
        request: Requests.Stream.IndexesAround.Request,
    ): CancelablePromise<Requests.Stream.IndexesAround.Response> => {
        return new CancelablePromise((resolve, reject) => {
            const stored = sessions.get(request.session);
            if (stored === undefined) {
                return reject(new Error(`Session doesn't exist`));
            }
            stored.session
                .getStream()
                .getAroundIndexes(request.row)
                .then((result) => {
                    resolve(
                        new Requests.Stream.IndexesAround.Response({
                            session: stored.session.getUUID(),
                            before: result.before,
                            after: result.after,
                        }),
                    );
                })
                .catch((err: Error) => {
                    resolve(
                        new Requests.Stream.IndexesAround.Response({
                            session: stored.session.getUUID(),
                            before: undefined,
                            after: undefined,
                            error: err.message,
                        }),
                    );
                });
        });
    },
);
