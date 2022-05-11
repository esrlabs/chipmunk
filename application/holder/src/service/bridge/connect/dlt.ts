import { CancelablePromise } from '@platform/env/promise';
import { Observe } from 'rustcore';
import { sessions } from '@service/sessions';
import { Instance as Logger } from '@platform/env/logger';
import { jobs, aliases } from '@service/jobs';
import { FileType } from '@platform/types/files';
import { optionsToParserSettings } from '@platform/types/parsers/dlt';

import * as Requests from '@platform/ipc/request';

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
            const observe = jobs
                .create({
                    session: request.session,
                    desc: 'tail',
                    pinned: true,
                })
                .start();
            if (request.source.udp !== undefined) {
                stored.session
                    .getStream()
                    .observe(
                        Observe.DataSource.stream()
                            .upd(request.source.udp)
                            .dlt(optionsToParserSettings(request.options, false, 0, 0) as any),
                    )
                    .catch((err: Error) => {
                        log.error(`Fail to call observe. Error: ${err.message}`);
                    })
                    .finally(() => {
                        observe.done();
                    });
                resolve(
                    new Requests.Connect.Dlt.Response({
                        session: stored.session.getUUID(),
                    }),
                );
            } else if (request.source.tcp !== undefined) {
                resolve(
                    new Requests.Connect.Dlt.Response({
                        session: stored.session.getUUID(),
                        error: `tcp support isn't implemented yet`,
                    }),
                );
            } else if (request.source.serial !== undefined) {
                resolve(
                    new Requests.Connect.Dlt.Response({
                        session: stored.session.getUUID(),
                        error: `serial support isn't implemented yet`,
                    }),
                );
            } else if (request.source.process !== undefined) {
                resolve(
                    new Requests.Connect.Dlt.Response({
                        session: stored.session.getUUID(),
                        error: `process support isn't implemented yet`,
                    }),
                );
            } else {
                return reject(new Error(`Not supported type of transport`));
            }
        });
    },
);
