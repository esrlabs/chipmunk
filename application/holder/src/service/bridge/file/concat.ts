import { CancelablePromise } from 'platform/env/promise';
import { Observe } from 'rustcore';
import { sessions } from '@service/sessions';
import { Instance as Logger } from 'platform/env/logger';
import { jobs, aliases } from '@service/jobs';
import { FileType } from 'platform/types/files';
import { defaultParserSettings, optionsToParserSettings } from 'platform/types/parsers/dlt';

import * as Requests from 'platform/ipc/request';

export const handler = Requests.InjectLogger<
    Requests.File.Concat.Request,
    CancelablePromise<Requests.File.Concat.Response>
>(
    (
        log: Logger,
        request: Requests.File.Concat.Request,
    ): CancelablePromise<Requests.File.Concat.Response> => {
        return new CancelablePromise((resolve, reject) => {
            const stored = sessions.get(request.session);
            if (stored === undefined) {
                return reject(new Error(`Session doesn't exist`));
            }
            if (request.files !== undefined && request.files.length !== 0) {
                const reading = jobs
                    .create({
                        uuid: aliases.getFileReadingJobUuid(request.session),
                        session: request.session,
                        desc: 'reading',
                        pinned: false,
                    })
                    .start();
                switch (request.files[0].type) {
                    case FileType.Any:
                    case FileType.Text:
                        stored
                            .observe()
                            .start(
                                Observe.DataSource.concat(
                                    request.files.map((f) => f.filename),
                                ).text(),
                                'tail text',
                            )
                            .then(() => {
                                resolve(
                                    new Requests.File.Concat.Response({
                                        session: stored.session.getUUID(),
                                    }),
                                );
                            })
                            .catch((err: Error) => {
                                resolve(
                                    new Requests.File.Concat.Response({
                                        session: stored.session.getUUID(),
                                        error: err.message,
                                    }),
                                );
                            });
                        break;
                    case FileType.Dlt:
                        stored
                            .observe()
                            .start(
                                Observe.DataSource.concat(request.files.map((f) => f.filename)).dlt(
                                    request.files[0].options.dlt === undefined
                                        ? defaultParserSettings(true)
                                        : optionsToParserSettings(
                                              request.files[0].options.dlt,
                                              true,
                                              0,
                                              0,
                                          ),
                                ),
                                'tail DLT',
                            )
                            .then(() => {
                                resolve(
                                    new Requests.File.Concat.Response({
                                        session: stored.session.getUUID(),
                                    }),
                                );
                            })
                            .catch((err: Error) => {
                                resolve(
                                    new Requests.File.Concat.Response({
                                        session: stored.session.getUUID(),
                                        error: err.message,
                                    }),
                                );
                            });
                        break;
                    default:
                        reading.done();
                        return reject(new Error(`Not supported file type`));
                }
            } else {
                return reject(new Error(`Not supported source of data`));
            }
        });
    },
);
