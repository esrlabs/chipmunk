import { CancelablePromise } from 'platform/env/promise';
import { sessions, Jobs } from '@service/sessions';
import { Logger } from 'platform/log';
import { ICancelablePromise } from 'platform/env/promise';

import * as Requests from 'platform/ipc/request';

export const handler = Requests.InjectLogger<
    Requests.Search.NextNested.Request,
    ICancelablePromise<Requests.Search.NextNested.Response>
>(
    (
        log: Logger,
        request: Requests.Search.NextNested.Request,
    ): ICancelablePromise<Requests.Search.NextNested.Response> => {
        return new CancelablePromise<Requests.Search.NextNested.Response>((resolve, reject) => {
            const session_uuid = request.session;
            const stored = sessions.get(session_uuid);
            if (stored === undefined) {
                return reject(new Error(`Session doesn't exist`));
            }
            if (stored.isShutdowning()) {
                return reject(new Error(`Session is closing`));
            }
            stored.session
                .getSearch()
                .searchNestedMatch(request.filter, request.from)
                .then((pos: number | undefined) => {
                    resolve(
                        new Requests.Search.NextNested.Response({
                            session: session_uuid,
                            pos,
                        }),
                    );
                });
        });
    },
);
