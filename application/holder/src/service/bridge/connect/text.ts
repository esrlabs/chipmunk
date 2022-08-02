import { CancelablePromise } from 'platform/env/promise';
import { Observe } from 'rustcore';
import { sessions } from '@service/sessions';
import { Instance as Logger } from 'platform/env/logger';
import { jobs } from '@service/jobs';

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
            const observe = jobs
                .create({
                    session: request.session,
                    desc: 'streaming',
                    pinned: true,
                })
                .start();
            if (request.source.udp !== undefined) {
                stored.session
                    .getStream()
                    .observe(Observe.DataSource.stream().upd(request.source.udp).text())
                    .catch((err: Error) => {
                        log.error(`Fail to call observe. Error: ${err.message}`);
                    })
                    .finally(() => {
                        observe.done();
                    });
                resolve(
                    new Requests.Connect.Text.Response({
                        session: stored.session.getUUID(),
                    }),
                );
            } else if (request.source.tcp !== undefined) {
                resolve(
                    new Requests.Connect.Text.Response({
                        session: stored.session.getUUID(),
                        error: `tcp support isn't implemented yet`,
                    }),
                );
            } else if (request.source.serial !== undefined) {
                resolve(
                    new Requests.Connect.Text.Response({
                        session: stored.session.getUUID(),
                        error: `serial support isn't implemented yet`,
                    }),
                );
            } else if (request.source.process !== undefined) {
                stored.session
                    .getStream()
                    .observe(Observe.DataSource.stream().process(request.source.process).text())
                    .catch((err: Error) => {
                        log.error(`Fail to call observe. Error: ${err.message}`);
                    })
                    .finally(() => {
                        observe.done();
                    });
                resolve(
                    new Requests.Connect.Text.Response({
                        session: stored.session.getUUID(),
                    }),
                );
            } else {
                console.log(request);
                return reject(new Error(`Not supported type of transport`));
            }
        });
    },
);
