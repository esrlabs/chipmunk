import { CancelablePromise } from 'platform/env/promise';
import { Observe } from 'rustcore';
import { sessions } from '@service/sessions';
import { Logger } from 'platform/log';
import { optionsToParserSettings } from 'platform/types/parsers/someip';

import * as Requests from 'platform/ipc/request';

export const handler = Requests.InjectLogger<
    Requests.Connect.SomeIp.Request,
    CancelablePromise<Requests.Connect.SomeIp.Response>
>(
    (
        log: Logger,
        request: Requests.Connect.SomeIp.Request,
    ): CancelablePromise<Requests.Connect.SomeIp.Response> => {
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
                            .udp(request.source.udp)
                            .someip(optionsToParserSettings(request.options)),
                    )
                    .then(() => {
                        resolve(
                            new Requests.Connect.SomeIp.Response({
                                session: stored.session.getUUID(),
                            }),
                        );
                    })
                    .catch((err: Error) => {
                        resolve(
                            new Requests.Connect.SomeIp.Response({
                                session: stored.session.getUUID(),
                                error: err.message,
                            }),
                        );
                    });
            } else if (request.source.tcp !== undefined) {
                stored
                    .observe()
                    .start(
                        Observe.DataSource.stream()
                            .tcp(request.source.tcp)
                            .someip(optionsToParserSettings(request.options)),
                    )
                    .then(() => {
                        resolve(
                            new Requests.Connect.SomeIp.Response({
                                session: stored.session.getUUID(),
                            }),
                        );
                    })
                    .catch((err: Error) => {
                        resolve(
                            new Requests.Connect.SomeIp.Response({
                                session: stored.session.getUUID(),
                                error: err.message,
                            }),
                        );
                    });
            } else if (request.source.serial !== undefined) {
                stored
                    .observe()
                    .start(
                        Observe.DataSource.stream()
                            .serial(request.source.serial)
                            .someip(optionsToParserSettings(request.options)),
                    )
                    .then(() => {
                        resolve(
                            new Requests.Connect.SomeIp.Response({
                                session: stored.session.getUUID(),
                            }),
                        );
                    })
                    .catch((err: Error) => {
                        resolve(
                            new Requests.Connect.SomeIp.Response({
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
                            .someip(optionsToParserSettings(request.options)),
                    )
                    .then(() => {
                        resolve(
                            new Requests.Connect.SomeIp.Response({
                                session: stored.session.getUUID(),
                            }),
                        );
                    })
                    .catch((err: Error) => {
                        resolve(
                            new Requests.Connect.SomeIp.Response({
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
