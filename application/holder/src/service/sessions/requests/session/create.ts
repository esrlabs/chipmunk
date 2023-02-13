import { CancelablePromise } from 'platform/env/promise';
import { ISearchUpdated } from 'platform/types/filter';
import { Session, IEventIndexedMapUpdated, ISearchValuesUpdated } from 'rustcore';
import { sessions } from '@service/sessions';
import { Subscriber } from 'platform/env/subscription';
import { Instance as Logger } from 'platform/env/logger';
import { jobs, aliases } from '@service/jobs';

import * as Events from 'platform/ipc/event';
import * as Requests from 'platform/ipc/request';

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
                        session.getEvents().SearchUpdated.subscribe((event: ISearchUpdated) => {
                            if (!sessions.exists(uuid)) {
                                return;
                            }
                            Events.IpcEvent.emit(
                                new Events.Search.Updated.Event({
                                    session: uuid,
                                    rows: event.found,
                                    stat: event.stat,
                                }),
                            );
                        }),
                    );
                    subscriber.register(
                        session
                            .getEvents()
                            .SearchValuesUpdated.subscribe((event: ISearchValuesUpdated | null) => {
                                if (!sessions.exists(uuid)) {
                                    return;
                                }
                                Events.IpcEvent.emit(
                                    new Events.Values.Updated.Event({
                                        session: uuid,
                                        values: event === null ? null : event.values,
                                    }),
                                );
                            }),
                    );
                    subscriber.register(
                        session.getEvents().SearchMapUpdated.subscribe((map: string | null) => {
                            if (!sessions.exists(uuid)) {
                                return;
                            }
                            Events.IpcEvent.emit(
                                new Events.Search.MapUpdated.Event({
                                    session: uuid,
                                    map,
                                }),
                            );
                        }),
                    );
                    subscriber.register(
                        session
                            .getEvents()
                            .IndexedMapUpdated.subscribe((event: IEventIndexedMapUpdated) => {
                                if (!sessions.exists(uuid)) {
                                    return;
                                }
                                Events.IpcEvent.emit(
                                    new Events.Stream.IndexedMapUpdated.Event({
                                        session: uuid,
                                        len: event.len,
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
                                        job.done({
                                            icon: 'file_download',
                                            name: 'reading',
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
