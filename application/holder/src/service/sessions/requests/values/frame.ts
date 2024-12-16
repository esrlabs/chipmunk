import { CancelablePromise } from 'platform/env/promise';
import { sessions, Jobs } from '@service/sessions';
import { Logger } from 'platform/log';
import { ICancelablePromise } from 'platform/env/promise';

import * as Requests from 'platform/ipc/request';

export const handler = Requests.InjectLogger<
    Requests.Values.Frame.Request,
    ICancelablePromise<Requests.Values.Frame.Response>
>(
    (
        log: Logger,
        request: Requests.Values.Frame.Request,
    ): ICancelablePromise<Requests.Values.Frame.Response> => {
        return new CancelablePromise<Requests.Values.Frame.Response>((resolve, reject) => {
            const session_uuid = request.session;
            const stored = sessions.get(session_uuid);
            if (stored === undefined) {
                return reject(new Error(`Session doesn't exist`));
            }
            if (stored.isShutdowning()) {
                return reject(new Error(`Session is closing`));
            }
            stored.register(Jobs.values).registerAsUnknown(
                stored.session
                    .getSearch()
                    .getValues(request.width, request.from, request.to)
                    .then((map) => {
                        resolve(
                            new Requests.Values.Frame.Response({
                                session: session_uuid,
                                values: map,
                                canceled: false,
                            }),
                        );
                    })
                    .canceled(() => {
                        resolve(
                            new Requests.Values.Frame.Response({
                                session: session_uuid,
                                canceled: true,
                                values: new Map(),
                            }),
                        );
                    })
                    .catch((err) => {
                        log.warn(`Search values was finished with error: ${err.message}`);
                        resolve(
                            new Requests.Values.Frame.Response({
                                session: session_uuid,
                                canceled: false,
                                values: new Map(),
                                error: err.message,
                            }),
                        );
                    }),
            );
        });
    },
);
