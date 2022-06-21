import { CancelablePromise } from 'platform/env/promise';
import { sessions } from '@service/sessions';
import { Instance as Logger } from 'platform/env/logger';

import * as Requests from 'platform/ipc/request';

export const handler = Requests.InjectLogger<
    Requests.Search.Chunk.Request,
    CancelablePromise<Requests.Search.Chunk.Response>
>(
    (
        log: Logger,
        request: Requests.Search.Chunk.Request,
    ): CancelablePromise<Requests.Search.Chunk.Response> => {
        return new CancelablePromise((resolve, reject) => {
            const stored = sessions.get(request.session);
            if (stored === undefined) {
                return reject(new Error(`Session doesn't exist`));
            }
            if (stored.isShutdowning()) {
                return reject(new Error(`Session is closing`));
            }
            stored.session
                .getSearch()
                .grab(request.from, request.to - request.from + 1)
                .then((rows) => {
                    resolve(
                        new Requests.Search.Chunk.Response({
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
