import { CancelablePromise } from 'platform/env/promise';
import { sessions } from '@service/sessions';
import { Instance as Logger } from 'platform/env/logger';

import * as Requests from 'platform/ipc/request';

export const handler = Requests.InjectLogger<
    Requests.Stream.Indexed.Request,
    CancelablePromise<Requests.Stream.Indexed.Response>
>(
    (
        log: Logger,
        request: Requests.Stream.Indexed.Request,
    ): CancelablePromise<Requests.Stream.Indexed.Response> => {
        return new CancelablePromise((resolve, reject) => {
            const stored = sessions.get(request.session);
            if (stored === undefined) {
                return reject(new Error(`Session doesn't exist`));
            }
            stored.session
                .getStream()
                .grabIndexed(request.from, request.to - request.from + 1)
                .then((rows) => {
                    resolve(
                        new Requests.Stream.Indexed.Response({
                            session: stored.session.getUUID(),
                            from: request.from,
                            to: request.to,
                            rows,
                        }),
                    );
                })
                .catch(reject);
        });
    },
);
