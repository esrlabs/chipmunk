import { CancelablePromise } from 'platform/env/promise';
import { sessions } from '@service/sessions';
import { Instance as Logger } from 'platform/env/logger';

import * as Requests from 'platform/ipc/request';

export const handler = Requests.InjectLogger<
    Requests.Stream.IndexedLen.Request,
    CancelablePromise<Requests.Stream.IndexedLen.Response>
>(
    (
        _log: Logger,
        request: Requests.Stream.IndexedLen.Request,
    ): CancelablePromise<Requests.Stream.IndexedLen.Response> => {
        return new CancelablePromise((resolve, reject) => {
            const stored = sessions.get(request.session);
            if (stored === undefined) {
                return reject(new Error(`Session doesn't exist`));
            }
            stored.session
                .getStream()
                .getIndexedLen()
                .then((len: number) => {
                    resolve(
                        new Requests.Stream.IndexedLen.Response({
                            session: stored.session.getUUID(),
                            len,
                        }),
                    );
                })
                .catch(reject);
        });
    },
);
