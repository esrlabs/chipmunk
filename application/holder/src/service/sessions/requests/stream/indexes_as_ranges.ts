import { CancelablePromise } from 'platform/env/promise';
import { sessions } from '@service/sessions';
import { Logger } from 'platform/log';

import * as Requests from 'platform/ipc/request';

export const handler = Requests.InjectLogger<
    Requests.Stream.IndexesAsRanges.Request,
    CancelablePromise<Requests.Stream.IndexesAsRanges.Response>
>(
    (
        log: Logger,
        request: Requests.Stream.IndexesAsRanges.Request,
    ): CancelablePromise<Requests.Stream.IndexesAsRanges.Response> => {
        return new CancelablePromise((resolve, reject) => {
            const stored = sessions.get(request.session);
            if (stored === undefined) {
                return reject(new Error(`Session doesn't exist`));
            }
            stored.session
                .getStream()
                .getIndexedRanges()
                .then((ranges) => {
                    resolve(
                        new Requests.Stream.IndexesAsRanges.Response({
                            session: stored.session.getUUID(),
                            ranges,
                        }),
                    );
                })
                .catch(reject);
        });
    },
);
