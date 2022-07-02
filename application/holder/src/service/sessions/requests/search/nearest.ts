import { CancelablePromise } from 'platform/env/promise';
import { sessions, Jobs } from '@service/sessions';
import { Instance as Logger } from 'platform/env/logger';

import * as Requests from 'platform/ipc/request';

export const handler = Requests.InjectLogger<
    Requests.Search.Nearest.Request,
    CancelablePromise<Requests.Search.Nearest.Response>
>(
    (
        log: Logger,
        request: Requests.Search.Nearest.Request,
    ): CancelablePromise<Requests.Search.Nearest.Response> => {
        return new CancelablePromise<Requests.Search.Nearest.Response>((resolve, reject) => {
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
                        .getNearest(request.row)
                        .then((nearest) => {
                            resolve(
                                new Requests.Search.Nearest.Response({
                                    session: request.session,
                                    stream: nearest.position,
                                    position: nearest.index,
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
