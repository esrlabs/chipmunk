import { CancelablePromise } from 'platform/env/promise';
import { sessions, Jobs } from '@service/sessions';
import { Logger } from 'platform/log';
import { ICancelablePromise } from 'platform/env/promise';

import * as Requests from 'platform/ipc/request';

export const handler = Requests.InjectLogger<
    Requests.Search.Search.Request,
    ICancelablePromise<Requests.Search.Search.Response>
>(
    (
        log: Logger,
        request: Requests.Search.Search.Request,
    ): ICancelablePromise<Requests.Search.Search.Response> => {
        return new CancelablePromise<Requests.Search.Search.Response>((resolve, reject) => {
            const session_uuid = request.session;
            const stored = sessions.get(session_uuid);
            if (stored === undefined) {
                return reject(new Error(`Session doesn't exist`));
            }
            if (stored.isShutdowning()) {
                return reject(new Error(`Session is closing`));
            }
            stored.register(Jobs.search).registerAsUnknown(
                stored.session
                    .getSearch()
                    .search(request.filters)
                    .then((found: number) => {
                        resolve(
                            new Requests.Search.Search.Response({
                                session: session_uuid,
                                found,
                                canceled: false,
                            }),
                        );
                    })
                    .canceled(() => {
                        resolve(
                            new Requests.Search.Search.Response({
                                session: session_uuid,
                                found: 0,
                                canceled: true,
                            }),
                        );
                    })
                    .catch((err) => {
                        log.warn(`Search was finished with error: ${err.message}`);
                        resolve(
                            new Requests.Search.Search.Response({
                                session: session_uuid,
                                found: 0,
                                canceled: false,
                                error: err.message,
                            }),
                        );
                    }),
            );
        });
    },
);
