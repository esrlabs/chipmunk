import { CancelablePromise } from 'platform/env/promise';
import { sessions } from '@service/sessions';
import { Instance as Logger } from 'platform/env/logger';

import * as Requests from 'platform/ipc/request';

export const handler = Requests.InjectLogger<
    Requests.Search.Map.Request,
    CancelablePromise<Requests.Search.Map.Response>
>(
    (
        log: Logger,
        request: Requests.Search.Map.Request,
    ): CancelablePromise<Requests.Search.Map.Response> => {
        return new CancelablePromise<Requests.Search.Map.Response>((resolve, reject) => {
            const stored = sessions.get(request.session);
            if (stored === undefined) {
                return reject(new Error(`Session doesn't exist`));
            }
            if (stored.isShutdowning()) {
                return reject(new Error(`Session is closing`));
            }
            stored.session
                .getSearch()
                .getMap(request.len, request.from, request.to)
                .then((map) => {
                    resolve(
                        new Requests.Search.Map.Response({
                            session: request.session,
                            map,
                            from: request.from === undefined ? 0 : request.from,
                            to: request.to === undefined ? 0 : request.to,
                        }),
                    );
                })
                .catch((error: Error) => {
                    reject(error);
                });
        });
    },
);
