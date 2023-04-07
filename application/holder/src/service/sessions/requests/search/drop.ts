import { CancelablePromise } from 'platform/env/promise';
import { sessions, Jobs } from '@service/sessions';
import { Logger } from 'platform/log';

import * as Requests from 'platform/ipc/request';

export const handler = Requests.InjectLogger<
    Requests.Search.Drop.Request,
    CancelablePromise<Requests.Search.Drop.Response>
>(
    (
        log: Logger,
        request: Requests.Search.Drop.Request,
    ): CancelablePromise<Requests.Search.Drop.Response> => {
        return new CancelablePromise<Requests.Search.Drop.Response>((resolve, reject) => {
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
                    log.error(`Fail to cancel search operations; error: ${err.message}`);
                })
                .finally(() => {
                    stored.session
                        .getSearch()
                        .drop()
                        .then(() => {
                            resolve(
                                new Requests.Search.Drop.Response({
                                    session: request.session,
                                }),
                            );
                        })
                        .catch(reject);
                });
        });
    },
);
