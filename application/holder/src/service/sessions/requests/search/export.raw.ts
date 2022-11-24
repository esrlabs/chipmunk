import { CancelablePromise } from 'platform/env/promise';
import { sessions } from '@service/sessions';
import { Instance as Logger } from 'platform/env/logger';

import * as Requests from 'platform/ipc/request';

export const handler = Requests.InjectLogger<
    Requests.Search.ExportRaw.Request,
    CancelablePromise<Requests.Search.ExportRaw.Response>
>(
    (
        log: Logger,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        request: Requests.Search.ExportRaw.Request,
    ): CancelablePromise<Requests.Search.ExportRaw.Response> => {
        return new CancelablePromise<Requests.Search.ExportRaw.Response>((resolve, reject) => {
            const session_uuid = request.session;
            const stored = sessions.get(session_uuid);
            if (stored === undefined) {
                return reject(new Error(`Session doesn't exist`));
            }
            stored.session
                .getSearch()
                .exportRaw(request.dest, request.ranges)
                .then((complete) => {
                    resolve(
                        new Requests.Search.ExportRaw.Response({
                            complete,
                        }),
                    );
                })
                .catch((err: Error) => {
                    resolve(
                        new Requests.Search.ExportRaw.Response({
                            complete: false,
                            error: err.message,
                        }),
                    );
                });
        });
    },
);
