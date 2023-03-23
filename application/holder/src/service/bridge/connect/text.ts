import { CancelablePromise } from 'platform/env/promise';
import { Observe } from 'rustcore';
import { sessions } from '@service/sessions';
import { Instance as Logger } from 'platform/env/logger';

import * as os from 'os';
import * as fs from 'fs';
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
                    .start(Observe.DataSource.stream().udp(request.source.udp).text())
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
                stored
                    .observe()
                    .start(Observe.DataSource.stream().tcp(request.source.tcp).text())
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
            } else if (request.source.serial !== undefined) {
                stored
                    .observe()
                    .start(Observe.DataSource.stream().serial(request.source.serial).text())
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
                if (request.source.process.cwd.trim() === '') {
                    request.source.process.cwd = os.homedir();
                }
                if (!fs.existsSync(request.source.process.cwd)) {
                    return reject(
                        new Error(
                            `Working directory "${request.source.process.cwd}" doesn't exist`,
                        ),
                    );
                }
                stored
                    .observe()
                    .start(Observe.DataSource.stream().process(request.source.process).text())
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
                return reject(new Error(`Not supported type of transport`));
            }
        });
    },
);
