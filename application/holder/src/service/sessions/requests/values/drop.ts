import { CancelablePromise } from 'platform/env/promise';
import { sessions, Jobs } from '@service/sessions';
import { Instance as Logger } from 'platform/env/logger';

import * as Requests from 'platform/ipc/request';

export const handler = Requests.InjectLogger<
    Requests.Values.Drop.Request,
    CancelablePromise<Requests.Values.Drop.Response>
>(
    (
        log: Logger,
        request: Requests.Values.Drop.Request,
    ): CancelablePromise<Requests.Values.Drop.Response> => {
        return new CancelablePromise<Requests.Values.Drop.Response>((resolve, reject) => {
            const stored = sessions.get(request.session);
            if (stored === undefined) {
                return reject(new Error(`Session doesn't exist`));
            }
            if (stored.isShutdowning()) {
                return reject(new Error(`Session is closing`));
            }
            stored
                .register(Jobs.search)
                .abort('aborting')
                .catch((err: Error) => {
                    log.error(`Fail to cancel search values operations; error: ${err.message}`);
                })
                .finally(() => {
                    stored.session
                        .getSearch()
                        .drop()
                        .then(() => {
                            resolve(
                                new Requests.Values.Drop.Response({
                                    session: request.session,
                                }),
                            );
                        })
                        .catch((error: Error) => {
                            reject(error);
                        });
                });
        });
    },
);
