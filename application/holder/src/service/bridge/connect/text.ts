import { CancelablePromise } from 'platform/env/promise';
import { Observe } from 'rustcore';
import { sessions } from '@service/sessions';
import { Instance as Logger } from 'platform/env/logger';

import * as Requests from 'platform/ipc/request';

export const handler = Requests.InjectLogger<
    Requests.Connect.Text.Request,
    CancelablePromise<Requests.Connect.Text.Response>
>(
    (
        log: Logger,
        request: Requests.Connect.Text.Request,
    ): CancelablePromise<Requests.Connect.Text.Response> => {
        return new CancelablePromise((resolve, reject) => {
            const stored = sessions.get(request.session);
            if (stored === undefined) {
                return reject(new Error(`Session doesn't exist`));
            }
            if (request.source.udp !== undefined) {
                stored
                    .observe()
                    .start(
                        Observe.DataSource.stream().upd(request.source.udp).text(),
                        'text on UDP',
                    )
                    .then(() => {
                        resolve(
                            new Requests.Connect.Text.Response({
                                session: stored.session.getUUID(),
                            }),
                        );
                    })
                    .catch((err: Error) => {
                        resolve(
                            new Requests.Connect.Text.Response({
                                session: stored.session.getUUID(),
                                error: err.message,
                            }),
                        );
                    });
            } else if (request.source.tcp !== undefined) {
                resolve(
                    new Requests.Connect.Text.Response({
                        session: stored.session.getUUID(),
                        error: `tcp support isn't implemented yet`,
                    }),
                );
            } else if (request.source.serial !== undefined) {
                stored
                    .observe(
                        Observe.DataSource.stream().serial(request.source.serial).text(),
                        'text on serial',
                    )
                    .then(() => {
                        resolve(
                            new Requests.Connect.Text.Response({
                                session: stored.session.getUUID(),
                            }),
                        );
                    })
                    .catch((err: Error) => {
                        resolve(
                            new Requests.Connect.Text.Response({
                                session: stored.session.getUUID(),
                                error: err.message,
                            }),
                        );
                    });
                resolve(
                    new Requests.Connect.Text.Response({
                        session: stored.session.getUUID(),
                    }),
                );
            } else if (request.source.process !== undefined) {
                stored
                    .observe()
                    .start(
                        Observe.DataSource.stream().process(request.source.process).text(),
                        'text on process',
                    )
                    .then(() => {
                        resolve(
                            new Requests.Connect.Text.Response({
                                session: stored.session.getUUID(),
                            }),
                        );
                    })
                    .catch((err: Error) => {
                        resolve(
                            new Requests.Connect.Text.Response({
                                session: stored.session.getUUID(),
                                error: err.message,
                            }),
                        );
                    });
            } else {
                console.log(request);
                return reject(new Error(`Not supported type of transport`));
            }
        });
    },
);
