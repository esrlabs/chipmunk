import { CancelablePromise } from 'platform/env/promise';
import { Observe } from 'rustcore';
import { sessions } from '@service/sessions';
import { Instance as Logger } from 'platform/env/logger';
import { jobs, aliases } from '@service/jobs';
import { FileType } from 'platform/types/files';
import { defaultParserSettings, optionsToParserSettings } from 'platform/types/parsers/dlt';

import * as Requests from 'platform/ipc/request';

export const handler = Requests.InjectLogger<
    Requests.File.Open.Request,
    CancelablePromise<Requests.File.Open.Response>
>(
    (
        log: Logger,
        request: Requests.File.Open.Request,
    ): CancelablePromise<Requests.File.Open.Response> => {
        return new CancelablePromise((resolve, reject) => {
            const stored = sessions.get(request.session);
            if (stored === undefined) {
                return reject(new Error(`Session doesn't exist`));
            }
            if (request.file !== undefined) {
                const reading = jobs
                    .create({
                        uuid: aliases.getFileReadingJobUuid(request.session),
                        session: request.session,
                        name: 'reading',
                        desc: `file: ${request.file.name}`,
                    })
                    .start();
                switch (request.file.type) {
                    case FileType.Any:
                    case FileType.Text:
                        stored
                            .observe()
                            .start(Observe.DataSource.file(request.file.filename).text())
                            .then(() => {
                                resolve(
                                    new Requests.File.Open.Response({
                                        session: stored.session.getUUID(),
                                    }),
                                );
                            })
                            .catch((err: Error) => {
                                resolve(
                                    new Requests.File.Open.Response({
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
                                Observe.DataSource.file(request.file.filename).dlt(
                                    request.file.options.dlt === undefined
                                        ? defaultParserSettings(true)
                                        : optionsToParserSettings(
                                              request.file.options.dlt,
                                              true,
                                              0,
                                              0,
                                          ),
                                ),
                            )
                            .then(() => {
                                resolve(
                                    new Requests.File.Open.Response({
                                        session: stored.session.getUUID(),
                                    }),
                                );
                            })
                            .catch((err: Error) => {
                                resolve(
                                    new Requests.File.Open.Response({
                                        session: stored.session.getUUID(),
                                        error: err.message,
                                    }),
                                );
                            });
                        break;
                    case FileType.Pcap:
                        stored
                            .observe()
                            .start(
                                Observe.DataSource.file(request.file.filename).pcap({
                                    dlt:
                                        request.file.options.dlt === undefined
                                            ? defaultParserSettings(false)
                                            : optionsToParserSettings(
                                                  request.file.options.dlt,
                                                  false,
                                                  0,
                                                  0,
                                              ),
                                }),
                            )
                            .then(() => {
                                resolve(
                                    new Requests.File.Open.Response({
                                        session: stored.session.getUUID(),
                                    }),
                                );
                            })
                            .catch((err: Error) => {
                                resolve(
                                    new Requests.File.Open.Response({
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
