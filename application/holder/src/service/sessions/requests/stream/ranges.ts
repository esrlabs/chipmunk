import { CancelablePromise } from 'platform/env/promise';
import { sessions } from '@service/sessions';
import { Logger } from 'platform/log';

import * as Requests from 'platform/ipc/request';

export const handler = Requests.InjectLogger<
    Requests.Stream.Ranges.Request,
    CancelablePromise<Requests.Stream.Ranges.Response>
>(
    (
        log: Logger,
        request: Requests.Stream.Ranges.Request,
    ): CancelablePromise<Requests.Stream.Ranges.Response> => {
        return new CancelablePromise((resolve, reject) => {
            const stored = sessions.get(request.session);
            if (stored === undefined) {
                return reject(new Error(`Session doesn't exist`));
            }
            stored.session
                .getStream()
                .grabRanges(request.ranges)
                .then((rows) => {
                    resolve(
                        new Requests.Stream.Ranges.Response({
                            session: stored.session.getUUID(),
                            rows,
                        }),
                    );
                })
                .catch(reject);
        });
    },
);
