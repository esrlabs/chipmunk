// tslint:disable

// We need to provide path to TypeScript types definitions
/// <reference path="../node_modules/@types/jasmine/index.d.ts" />
/// <reference path="../node_modules/@types/node/index.d.ts" />

import { Session, SessionStream, Observe } from '../src/api/session';
import { IGrabbedElement } from '../src/interfaces/index';
import { finish, createSampleFile } from './common';
import { getLogger } from '../src/util/logging';

describe('Errors', () => {
    it('Test 1. Error: Stream len before observe', (done) => {
        const logger = getLogger('Errors. Test 1');
        Session.create()
            .then((session: Session) => {
                // Set provider into debug mode
                session.debug(true, 'Test 1. Error: Stream len before observe');
                const stream: SessionStream = session.getStream();
                stream
                    .len()
                    .then((len: number) => {
                        finish(
                            session,
                            done,
                            new Error(`Length of stream should not be available`),
                        );
                    })
                    .catch((err: Error) => {
                        finish(session, done);
                    });
            })
            .catch((err: Error) => {
                finish(
                    undefined,
                    done,
                    new Error(
                        `Fail to create session due error: ${
                            err instanceof Error ? err.message : err
                        }`,
                    ),
                );
            });
    });

    it('Test 2. Error: Search len before observe', (done) => {
        const logger = getLogger('Errors. Test 2');
        Session.create()
            .then((session: Session) => {
                // Set provider into debug mode
                session.debug(true, 'Test 2. Error: Search len before observe');
                const search = session.getSearch();
                search
                    .len()
                    .then((len: number) => {
                        expect(len).toEqual(0);
                        session
                            .getNativeSession()
                            .getSearchLen()
                            .then((count: number) => {
                                expect(count).toEqual(0);
                                finish(session, done);
                            })
                            .catch((err: Error) => {
                                finish(session, done, err);
                            });
                    })
                    .catch((err: Error) => {
                        finish(session, done, err);
                    });
            })
            .catch((err: Error) => {
                finish(
                    undefined,
                    done,
                    new Error(
                        `Fail to create session due error: ${
                            err instanceof Error ? err.message : err
                        }`,
                    ),
                );
            });
    });

    it('Test 3. Error: search before observe', (done) => {
        const logger = getLogger('Errors. Test 3');
        Session.create()
            .then((session: Session) => {
                session.debug(true, 'Test 3. Error: search before observe');
                const search = session.getSearch();
                search
                    .search([
                        {
                            filter: 'match',
                            flags: { reg: true, word: true, cases: false },
                        },
                    ])
                    .then((_) => finish(session, done, new Error('Search should not be available')))
                    .catch((_) => finish(session, done));
            })
            .catch((err: Error) => {
                finish(
                    undefined,
                    done,
                    new Error(
                        `Fail to create session due error: ${
                            err instanceof Error ? err.message : err
                        }`,
                    ),
                );
            });
    });

    it('Test 4. Assign fake file', (done) => {
        const logger = getLogger('Errors. Test 4');
        Session.create()
            .then((session: Session) => {
                const stream = session.getStream();
                session.debug(true, 'Test 4. Error: Assign fake file');
                stream
                    .observe(Observe.DataSource.file('/fake/path/to/fake/file').text())
                    .then(
                        finish.bind(
                            null,
                            session,
                            done,
                            new Error(`Not exist file cannot be opened`),
                        ),
                    )
                    .catch(finish.bind(null, session, done));
            })
            .catch((err: Error) => {
                finish(
                    undefined,
                    done,
                    new Error(
                        `Fail to create session due error: ${
                            err instanceof Error ? err.message : err
                        }`,
                    ),
                );
            });
    });

    it('Test 5. Assign and grab invalid range', (done) => {
        const logger = getLogger('Errors. Test 5');
        Session.create()
            .then((session: Session) => {
                session.debug(true, 'Test 5. Assign and grab invalid range');
                const stream = session.getStream();
                const tmpobj = createSampleFile(
                    5000,
                    logger,
                    (i: number) => `some line data: ${i}\n`,
                );
                stream
                    .observe(Observe.DataSource.file(tmpobj.name).text())
                    .then(() => {
                        // While we do not have operation id
                        stream
                            .grab(6000, 1000)
                            .then((result: IGrabbedElement[]) => {
                                finish(
                                    session,
                                    done,
                                    new Error(`grabber should not return results`),
                                );
                            })
                            .catch((err: Error) => {
                                expect(err).toBeInstanceOf(Error);
                                finish(session, done);
                            });
                    })
                    .catch(finish.bind(null, session, done));
            })
            .catch((err: Error) => {
                finish(
                    undefined,
                    done,
                    new Error(
                        `Fail to create session due error: ${
                            err instanceof Error ? err.message : err
                        }`,
                    ),
                );
            });
    });

    it('Test 6. Assign & single and grab invalid range', (done) => {
        const logger = getLogger('Errors. Test 6');
        Session.create()
            .then((session: Session) => {
                session.debug(true, 'Test 6. Assign & single and grab invalid range');
                const stream: SessionStream = session.getStream();
                const search = session.getSearch();
                const tmpobj = createSampleFile(
                    5000,
                    logger,
                    (i: number) =>
                        `[${i}]:: ${
                            i % 100 === 0 || i <= 5 ? `some match line data\n` : `some line data\n`
                        }`,
                );
                stream
                    .observe(Observe.DataSource.file(tmpobj.name).text())
                    .then(() => {
                        // metadata was created
                        search
                            .search([
                                {
                                    filter: 'match',
                                    flags: { reg: true, word: false, cases: false },
                                },
                            ])
                            .then((_) => {
                                search
                                    .len()
                                    .then((len: number) => {
                                        expect(len).toEqual(55);
                                        search
                                            .grab(6000, 1000)
                                            .then((result: IGrabbedElement[]) => {
                                                finish(
                                                    session,
                                                    done,
                                                    new Error(
                                                        `search grabber should not return results`,
                                                    ),
                                                );
                                            })
                                            .catch((err: Error) => {
                                                expect(err).toBeInstanceOf(Error);
                                                finish(session, done);
                                            });
                                    })
                                    .catch((err: Error) => {
                                        finish(session, done, err);
                                    });
                            })
                            .catch(finish.bind(null, session, done));
                    })
                    .catch(finish.bind(null, session, done));
            })
            .catch((err: Error) => {
                finish(
                    undefined,
                    done,
                    new Error(
                        `Fail to create session due error: ${
                            err instanceof Error ? err.message : err
                        }`,
                    ),
                );
            });
    });

    it('Test 7. Grab lines with negative length', (done) => {
        const logger = getLogger('Errors. Test 7');
        Session.create()
            .then((session: Session) => {
                const stream: SessionStream = session.getStream();
                const tmpobj = createSampleFile(5, logger, (i: number) => `some line data: ${i}\n`);
                stream
                    .observe(Observe.DataSource.file(tmpobj.name).text())
                    .then(() => {
                        stream
                            .grab(1, -2)
                            .then((_) => {
                                finish(
                                    session,
                                    done,
                                    new Error('Grab from invalid range should not work'),
                                );
                            })
                            .catch((_) => finish(session, done));
                    })
                    .catch((err: Error) => {
                        finish.bind(
                            session,
                            done,
                            new Error(`Failed to observe file: ${err.message}`),
                        );
                    });
            })
            .catch((err: Error) => {
                finish(
                    undefined,
                    done,
                    new Error(
                        `Fail to create session due error: ${
                            err instanceof Error ? err.message : err
                        }`,
                    ),
                );
            });
    });
    it('Test 8. Grab lines with negative start', (done) => {
        const logger = getLogger('Errors. Test 8');
        Session.create()
            .then((session: Session) => {
                const stream: SessionStream = session.getStream();
                const tmpobj = createSampleFile(5, logger, (i: number) => `some line data: ${i}\n`);
                stream
                    .observe(Observe.DataSource.file(tmpobj.name).text())
                    .then(() => {
                        stream
                            .grab(-1, 2)
                            .then((_) =>
                                finish(session, done, new Error('Grab from invalid start worked')),
                            )
                            .catch((_) => finish(session, done));
                    })
                    .catch((err: Error) =>
                        finish(session, done, new Error(`Failed to observe file: ${err.message}`)),
                    );
            })
            .catch((err: Error) => {
                finish(
                    undefined,
                    done,
                    new Error(
                        `Fail to create session due error: ${
                            err instanceof Error ? err.message : err
                        }`,
                    ),
                );
            });
    });
});
