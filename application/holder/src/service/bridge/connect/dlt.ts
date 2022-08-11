import { CancelablePromise } from 'platform/env/promise';
import { Observe } from 'rustcore';
import { sessions } from '@service/sessions';
import { Instance as Logger } from 'platform/env/logger';
import { optionsToParserSettings } from 'platform/types/parsers/dlt';

import * as Requests from 'platform/ipc/request';

export const handler = Requests.InjectLogger<
    Requests.Connect.Dlt.Request,
    CancelablePromise<Requests.Connect.Dlt.Response>
>(
    (
        log: Logger,
        request: Requests.Connect.Dlt.Request,
    ): CancelablePromise<Requests.Connect.Dlt.Response> => {
        return new CancelablePromise((resolve, reject) => {
            const stored = sessions.get(request.session);
            if (stored === undefined) {
                return reject(new Error(`Session doesn't exist`));
            }
            if (request.source.udp !== undefined) {
                stored
                    .observe()
                    .start(
                        Observe.DataSource.stream()
                            .upd(request.source.udp)
                            .dlt(optionsToParserSettings(request.options, false, 0, 0)),
                        'DLT on UDP',
                    )
                    .then(() => {
                        resolve(
                            new Requests.Connect.Dlt.Response({
                                session: stored.session.getUUID(),
                            }),
                        );
                    })
                    .catch((err: Error) => {
                        resolve(
                            new Requests.Connect.Dlt.Response({
                                session: stored.session.getUUID(),
                                error: err.message,
                            }),
                        );
                    });
            } else if (request.source.tcp !== undefined) {
                resolve(
                    new Requests.Connect.Dlt.Response({
                        session: stored.session.getUUID(),
                        error: `tcp support isn't implemented yet`,
                    }),
                );
            } else if (request.source.serial !== undefined) {
                stored
                    .observe(
                        Observe.DataSource.stream()
                            .serial(request.source.serial)
                            .dlt(optionsToParserSettings(request.options, false, 0, 0)),
                        'DLT on serial',
                    )
                    .then(() => {
                        resolve(
                            new Requests.Connect.Dlt.Response({
                                session: stored.session.getUUID(),
                            }),
                        );
                    })
                    .catch((err: Error) => {
                        resolve(
                            new Requests.Connect.Dlt.Response({
                                session: stored.session.getUUID(),
                                error: err.message,
                            }),
                        );
                    });
            } else if (request.source.process !== undefined) {
                stored
                    .observe()
                    .start(
                        Observe.DataSource.stream()
                            .process(request.source.process)
                            .dlt(optionsToParserSettings(request.options, false, 0, 0)),
                        'DLT on process',
                    )
                    .then(() => {
                        resolve(
                            new Requests.Connect.Dlt.Response({
                                session: stored.session.getUUID(),
                            }),
                        );
                    })
                    .catch((err: Error) => {
                        resolve(
                            new Requests.Connect.Dlt.Response({
                                session: stored.session.getUUID(),
                                error: err.message,
                            }),
                        );
                    });
            } else {
                return reject(new Error(`Not supported type of transport`));
            }
        });
    },
);
