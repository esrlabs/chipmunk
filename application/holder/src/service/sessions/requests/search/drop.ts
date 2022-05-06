import { CancelablePromise } from '@platform/env/promise';
import { sessions } from '@service/sessions';
import { Instance as Logger } from '@platform/env/logger';

import * as Requests from '@platform/ipc/request';

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
                .catch((error: Error) => {
                    reject(error);
                });
        });
    },
);
