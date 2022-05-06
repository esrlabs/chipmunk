import { CancelablePromise } from '@platform/env/promise';
import { Session, Observe } from 'rustcore';
import { sessions } from '@service/sessions';
import { Subscriber } from '@platform/env/subscription';
import { Instance as Logger } from '@platform/env/logger';
import { jobs, aliases, Job } from '@service/jobs';
import { FileType } from '@platform/types/files';
import { defaultParserSettings, optionsToParserSettings } from '@platform/types/dlt';

import * as Events from '@platform/ipc/event';
import * as Requests from '@platform/ipc/request';

export const handler = Requests.InjectLogger<
    Requests.Session.Create.Request,
    CancelablePromise<Requests.Session.Create.Response>
>(
    (
        log: Logger,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        request: Requests.Session.Create.Request,
    ): CancelablePromise<Requests.Session.Create.Response> => {
        return new CancelablePromise((resolve, reject) => {
            Session.create()
                .then((session: Session) => {
                    const uuid = session.getUUID();
                    const subscriber = new Subscriber();
                    subscriber.register(
                        session.getEvents().StreamUpdated.subscribe((len: number) => {
                            if (!sessions.exists(uuid)) {
                                return;
                            }
                            Events.IpcEvent.emit(
                                new Events.Stream.Updated.Event({
                                    session: uuid,
                                    rows: len,
                                }),
                            );
                        }),
                    );
                    subscriber.register(
                        session.getEvents().SearchUpdated.subscribe((len: number) => {
                            if (!sessions.exists(uuid)) {
                                return;
                            }
                            Events.IpcEvent.emit(
                                new Events.Search.Updated.Event({
                                    session: uuid,
                                    rows: len,
                                }),
                            );
                        }),
                    );
                    subscriber.register(
                        session.getEvents().FileRead.subscribe(() => {
                            if (!sessions.exists(uuid)) {
                                return;
                            }
                            session
                                .getStream()
                                .len()
                                .then((len: number) => {
                                    const job = jobs.find(aliases.getFileReadingJobUuid(uuid));
                                    job !== undefined &&
                                        job.doneAndPinStatus({
                                            icon: 'file_download',
                                            desc: 'read',
                                        });

                                    Events.IpcEvent.emit(
                                        new Events.Stream.Updated.Event({
                                            session: uuid,
                                            rows: len,
                                        }),
                                    );
                                })
                                .catch((err: Error) => {
                                    log.error(`Fail to get len of stream: ${err.message}`);
                                });
                        }),
                    );
                    sessions.add(session, subscriber);
                    sessions.setActive(uuid);
                    if (request.file !== undefined) {
                        const reading = jobs
                            .create({
                                uuid: aliases.getFileReadingJobUuid(session.getUUID()),
                                session: session.getUUID(),
                                desc: 'reading',
                                pinned: false,
                            })
                            .start();
                        const observe = jobs
                            .create({
                                session: uuid,
                                desc: 'tail',
                                pinned: true,
                            })
                            .start();
                        switch (request.file.type) {
                            case FileType.Any:
                            case FileType.Text:
                                // Opening file as text file
                                session
                                    .getStream()
                                    .observe(Observe.DataSource.asTextFile(request.file.filename))
                                    .catch((err: Error) => {
                                        log.error(`Fail to call observe. Error: ${err.message}`);
                                    })
                                    .finally(() => {
                                        observe.done();
                                    });
                                break;
                            case FileType.Dlt:
                                // Opening file as DLT file
                                console.log(
                                    request.file.options.dlt === undefined
                                        ? (defaultParserSettings(true) as any)
                                        : (optionsToParserSettings(
                                              request.file.options.dlt,
                                              true,
                                              0,
                                              0,
                                          ) as any),
                                );
                                session
                                    .getStream()
                                    .observe(
                                        Observe.DataSource.asDltFile(
                                            request.file.filename,
                                            request.file.options.dlt === undefined
                                                ? (defaultParserSettings(true) as any)
                                                : (optionsToParserSettings(
                                                      request.file.options.dlt,
                                                      true,
                                                      0,
                                                      0,
                                                  ) as any),
                                        ),
                                    )
                                    .catch((err: Error) => {
                                        log.error(`Fail to call observe. Error: ${err.message}`);
                                    })
                                    .finally(() => {
                                        observe.done();
                                    });
                                break;
                            default:
                                observe.done();
                                reading.done();
                                reject(new Error(`Unsupported format of file`));
                                return;
                        }
                    }
                    resolve(
                        new Requests.Session.Create.Response({
                            uuid: uuid,
                        }),
                    );
                })
                .catch((err: Error) => {
                    log.error(`Fail to create session: ${err.message}`);
                    reject(new Error(`Fail to create session`));
                });
        });
    },
);
