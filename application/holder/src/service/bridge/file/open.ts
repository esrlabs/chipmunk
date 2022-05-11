import { CancelablePromise } from '@platform/env/promise';
import { Observe } from 'rustcore';
import { sessions } from '@service/sessions';
import { Instance as Logger } from '@platform/env/logger';
import { jobs, aliases } from '@service/jobs';
import { FileType } from '@platform/types/files';

import * as Requests from '@platform/ipc/request';

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
                        desc: 'reading',
                        pinned: false,
                    })
                    .start();
                const observe = jobs
                    .create({
                        session: request.session,
                        desc: 'tail',
                        pinned: true,
                    })
                    .start();
                switch (request.file.type) {
                    case FileType.Any:
                    case FileType.Text:
                        stored.session
                            .getStream()
                            .observe(Observe.DataSource.file(request.file.filename).text())
                            .catch((err: Error) => {
                                log.error(`Fail to call observe. Error: ${err.message}`);
                            })
                            .finally(() => {
                                observe.done();
                            });
                        resolve(
                            new Requests.File.Open.Response({
                                session: stored.session.getUUID(),
                            }),
                        );
                        break;
                    case FileType.Dlt:
                        stored.session
                            .getStream()
                            .observe(
                                Observe.DataSource.file(request.file.filename).dlt({
                                    fibex_file_paths: undefined,
                                    filter_config: undefined,
                                    with_storage_header: true,
                                }),
                            )
                            .catch((err: Error) => {
                                log.error(`Fail to call observe. Error: ${err.message}`);
                            })
                            .finally(() => {
                                observe.done();
                            });
                        resolve(
                            new Requests.File.Open.Response({
                                session: stored.session.getUUID(),
                            }),
                        );
                        break;
                    default:
                        observe.done();
                        reading.doneAndPinStatus({
                            icon: 'file_download',
                            desc: 'read',
                        });
                        return reject(new Error(`Not supported file type`));
                }
            } else {
                return reject(new Error(`Not supported source of data`));
            }
        });
    },
);
