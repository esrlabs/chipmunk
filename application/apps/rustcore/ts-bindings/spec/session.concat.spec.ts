// tslint:disable
// We need to provide path to TypeScript types definitions
/// <reference path="../node_modules/@types/jasmine/index.d.ts" />
/// <reference path="../node_modules/@types/node/index.d.ts" />

import { initLogger } from './logger';
initLogger();
import { Factory } from '../src/api/session';
import { GrabbedElement } from 'platform/types/bindings';
import { createSampleFile, finish } from './common';
import { readConfigurationFile } from './config';

import * as runners from './runners';

const config = readConfigurationFile().get().tests.concat;

describe('Concat', function () {
    it(config.regular.list[1], function () {
        return runners.withSession(config.regular, 1, async (logger, done, comps) => {
            const tmpobj_a = createSampleFile(
                100,
                logger,
                (i: number) => `file a: some line data: ${i}\n`,
            );
            const tmpobj_b = createSampleFile(
                100,
                logger,
                (i: number) => `file b: some line data: ${i}\n`,
            );
            comps.stream
                .observe(
                    new Factory.Concat()
                        .type(Factory.FileType.Text)
                        .files([tmpobj_a.name, tmpobj_b.name])
                        .asText()
                        .get()
                        .sterilized(),
                )
                .catch(finish.bind(null, comps.session, done));
            let grabbing: boolean = false;
            comps.events.StreamUpdated.subscribe((rows: number) => {
                if (rows < 120 || grabbing) {
                    return;
                }
                grabbing = true;
                comps.stream
                    .grab(98, 4)
                    .then((result: GrabbedElement[]) => {
                        logger.debug('result of grab was: ' + JSON.stringify(result));
                        expect(result.map((i) => i.content)).toEqual([
                            'file a: some line data: 98',
                            'file a: some line data: 99',
                            'file b: some line data: 0',
                            'file b: some line data: 1',
                        ]);
                        finish(comps.session, done);
                    })
                    .catch((err: Error) => {
                        finish(
                            comps.session,
                            done,
                            new Error(
                                `Fail to grab data due error: ${
                                    err instanceof Error ? err.message : err
                                }`,
                            ),
                        );
                    });
            });
        });
    });

    // it(config.regular.list[2], function () {
    //     return runners.withSession(config.regular, 2, async (logger, done, collector) => {
    //         Session.create()
    //             .then((session: Session) => {
    //                 // Set provider into debug mode
    //                 session.debug(true);
    //                 const stream = session.getStream();
    //                 if (stream instanceof Error) {
    //                     finish(session, done, stream);
    //                     return;
    //                 }
    //                 const events = session.getEvents();
    //                 if (events instanceof Error) {
    //                     finish(session, done, events);
    //                     return;
    //                 }
    //                 stream
    //                     .observe(
    //                         Observe.DataSource.file(config.regular.files['pcapng']).pcapng({
    //                             dlt: {
    //                                 filter_config: undefined,
    //                                 fibex_file_paths: undefined,
    //                                 with_storage_header: false,
    //                             },
    //                         }),
    //                     )
    //                     .catch(finish.bind(null, session, done));
    //                 let grabbing: boolean = false;
    //                 let received: number = 0;
    //                 const timeout = setTimeout(() => {
    //                     finish(
    //                         session,
    //                         done,
    //                         new Error(
    //                             `Failed because timeout. Waited for at least 100 rows. Has been gotten: ${received}`,
    //                         ),
    //                     );
    //                 }, 20000);
    //                 events.StreamUpdated.subscribe((rows: number) => {
    //                     received = rows;
    //                     if (rows < 100 || grabbing) {
    //                         return;
    //                     }
    //                     clearTimeout(timeout);
    //                     grabbing = true;
    //                     stream
    //                         .grab(1, 10)
    //                         .then((result: GrabbedElement[]) => {
    //                             expect(result.length).toEqual(10);
    //                             logger.debug('result of grab was: ' + JSON.stringify(result));
    //                             finish(session, done);
    //                         })
    //                         .catch((err: Error) => {
    //                             finish(
    //                                 session,
    //                                 done,
    //                                 new Error(
    //                                     `Fail to grab data due error: ${
    //                                         err instanceof Error ? err.message : err
    //                                     }`,
    //                                 ),
    //                             );
    //                         });
    //                 });
    //             })
    //             .catch((err: Error) => {
    //                 finish(
    //                     undefined,
    //                     done,
    //                     new Error(
    //                         `Fail to create session due error: ${
    //                             err instanceof Error ? err.message : err
    //                         }`,
    //                     ),
    //                 );
    //             });
    //     });
    // });

    // it(config.regular.list[3], function () {
    //     return runners.withSession(config.regular, 3, async (logger, done, collector) => {
    //         Session.create()
    //             .then((session: Session) => {
    //                 // Set provider into debug mode
    //                 session.debug(true);
    //                 const stream = session.getStream();
    //                 if (stream instanceof Error) {
    //                     finish(session, done, stream);
    //                     return;
    //                 }
    //                 const events = session.getEvents();
    //                 if (events instanceof Error) {
    //                     finish(session, done, events);
    //                     return;
    //                 }
    //                 stream
    //                     .observe(
    //                         Observe.DataSource.file(config.regular.files['dlt']).dlt({
    //                             filter_config: undefined,
    //                             fibex_file_paths: undefined,
    //                             with_storage_header: true,
    //                         }),
    //                     )
    //                     .catch(finish.bind(null, session, done));
    //                 let grabbing: boolean = false;
    //                 let received: number = 0;
    //                 const timeout = setTimeout(() => {
    //                     finish(
    //                         session,
    //                         done,
    //                         new Error(
    //                             `Failed because timeout. Waited for at least 100 rows. Has been gotten: ${received}`,
    //                         ),
    //                     );
    //                 }, 20000);
    //                 events.StreamUpdated.subscribe((rows: number) => {
    //                     received = rows;
    //                     if (rows < 100 || grabbing) {
    //                         return;
    //                     }
    //                     clearTimeout(timeout);
    //                     grabbing = true;
    //                     stream
    //                         .grab(1, 10)
    //                         .then((result: GrabbedElement[]) => {
    //                             expect(result.length).toEqual(10);
    //                             logger.debug('result of grab was: ' + JSON.stringify(result));
    //                             finish(session, done);
    //                         })
    //                         .catch((err: Error) => {
    //                             finish(
    //                                 session,
    //                                 done,
    //                                 new Error(
    //                                     `Fail to grab data due error: ${
    //                                         err instanceof Error ? err.message : err
    //                                     }`,
    //                                 ),
    //                             );
    //                         });
    //                 });
    //             })
    //             .catch((err: Error) => {
    //                 finish(
    //                     undefined,
    //                     done,
    //                     new Error(
    //                         `Fail to create session due error: ${
    //                             err instanceof Error ? err.message : err
    //                         }`,
    //                     ),
    //                 );
    //             });
    //     });
    // });
});
