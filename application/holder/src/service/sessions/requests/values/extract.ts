import { CancelablePromise } from 'platform/env/promise';
import { sessions, Jobs } from '@service/sessions';
import { Instance as Logger } from 'platform/env/logger';
import { ICancelablePromise } from 'platform/env/promise';

import * as Requests from 'platform/ipc/request';

export const handler = Requests.InjectLogger<
    Requests.Values.Extract.Request,
    ICancelablePromise<Requests.Values.Extract.Response>
>(
    (
        log: Logger,
        request: Requests.Values.Extract.Request,
    ): ICancelablePromise<Requests.Values.Extract.Response> => {
        return new CancelablePromise<Requests.Values.Extract.Response>((resolve, reject) => {
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
                    .values(request.filters)
                    .then((values) => {
                        resolve(
                            new Requests.Values.Extract.Response({
                                session: session_uuid,
                                values,
                                canceled: false,
                            }),
                        );
                    })
                    .canceled(() => {
                        resolve(
                            new Requests.Values.Extract.Response({
                                session: session_uuid,
                                values: new Map(),
                                canceled: true,
                            }),
                        );
                    })
                    .catch((err) => {
                        log.warn(`Search values was finished with error: ${err.message}`);
                        resolve(
                            new Requests.Values.Extract.Response({
                                session: session_uuid,
                                values: new Map(),
                                canceled: false,
                                error: err.message,
                            }),
                        );
                    }),
            );
        });
    },
);
