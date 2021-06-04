// tslint:disable

// We need to provide path to TypeScript types definitions
/// <reference path="../node_modules/@types/jasmine/index.d.ts" />
/// <reference path="../node_modules/@types/node/index.d.ts" />

import { Session } from '../src/api/session';
import { IGrabbedElement } from '../src/interfaces/index';
import { checkSessionDebugger, isAsyncResearchTest } from './common';

const TEST_LOG_FILE: string | undefined = (() => {
    const envValue = (process.env as any)['TEXT_LOG_FILE_FOR_JASMIN'];
    if (typeof envValue === 'string' && envValue.trim() !== '') {
        return envValue.trim();
    } else {
        return undefined;
    }
})();

if (isAsyncResearchTest()) {
    // Ignore test
} else if (TEST_LOG_FILE === undefined) {
    console.log(`${'='.repeat(60)}`);
    console.log(`WARNING!`);
    console.log(`${'='.repeat(60)}`);
    console.log(`Please define a path to some huge log file using`);
    console.log(`export TEXT_LOG_FILE_FOR_JASMIN=path_to_file`);
    console.log(`${'='.repeat(60)}`);
    describe('Cancelations', function () {
        it('Assign file & cancel indexing', function (done) {
            fail(new Error(`Path to log file TEXT_LOG_FILE_FOR_JASMIN isn't defined`));
            done();
        });
    });
} else {
    describe('Cancelations', function () {
        it('Assign file & cancel indexing', function (done) {
            const session = new Session();
            // Set provider into debug mode
            session.debug(true);
            const stream = session.getStream();
            let canceled: boolean = false;
            if (stream instanceof Error) {
                fail(stream);
                return done();
            }
            const task = stream
                .assign(TEST_LOG_FILE, {})
                .then(() => {
                    fail(new Error('Operation is resolved, but should be canceled'));
                })
                .catch((err: Error) => {
                    fail(
                        new Error(
                            `Operation is rejected, but should be canceled. Error: ${err.message}`,
                        ),
                    );
                })
                .finally(() => {
                    if (canceled) {
                        // As soon as grabbing was calceled we should have len = 0 and calling
                        // native method should give us error (as soon as there are not inited grabber)
                        const len = stream.len();
                        expect(len).toEqual(0);
                        expect(session.getNativeSession().getStreamLen()).toBeInstanceOf(Error);
                        checkSessionDebugger(session);
                    } else {
                        fail(new Error(`Finish achived, but operation wasn't canceled`));
                    }
                    session.destroy();
                    done();
                })
                .canceled(() => {
                    canceled = true;
                    // We do not continue test here as soon as we want also check triggering of
                    // "finally" state
                });
            setTimeout(() => {
                task.abort();
            }, 500);
        });
    
        it('Assign file & cancel & assign again and grab', function (done) {
            const session = new Session();
            // Set provider into debug mode
            session.debug(true);
            const stream = session.getStream();
            let canceled: boolean = false;
            if (stream instanceof Error) {
                fail(stream);
                return done();
            }
            const task = stream
                .assign(TEST_LOG_FILE, {})
                .then(() => {
                    fail(new Error('Operation is resolved, but should be canceled'));
                })
                .catch((err: Error) => {
                    fail(
                        new Error(
                            `Operation is rejected, but should be canceled. Error: ${err.message}`,
                        ),
                    );
                })
                .finally(() => {
                    if (canceled) {
                        stream
                            .assign(TEST_LOG_FILE, {})
                            .then(() => {
                                let result: IGrabbedElement[] | Error = stream.grab(500, 5);
                                if (result instanceof Error) {
                                    fail(`Fail to grab data due error: ${result.message}`);
                                    return done();
                                }
                                console.log('result of grab was: ' + JSON.stringify(result));
                                expect(result.length).toEqual(5);
                                checkSessionDebugger(session);
                                done();
                            })
                            .catch((err: Error) => {
                                fail(err);
                                done();
                            })
                            .finally(() => {
                                session.destroy();
                            });
                    } else {
                        fail(new Error(`Finish achived, but operation wasn't canceled`));
                        session.destroy();
                        done();
                    }
                })
                .canceled(() => {
                    canceled = true;
                    // We do not continue test here as soon as we want also check triggering of
                    // "finally" state
                });
            setTimeout(() => {
                task.abort();
            }, 500);
        });
    
        it('Assign file & cancel & assign again and search', function (done) {
            const session = new Session();
            // Set provider into debug mode
            session.debug(true);
            let canceled: boolean = false;
            const stream = session.getStream();
            const search = session.getSearch();
            if (stream instanceof Error) {
                fail(stream);
                return done();
            }
            if (search instanceof Error) {
                fail(search);
                return done();
            }
            const task = stream
                .assign(TEST_LOG_FILE, {})
                .then(() => {
                    fail(new Error('Operation is resolved, but should be canceled'));
                })
                .catch((err: Error) => {
                    fail(
                        new Error(
                            `Operation is rejected, but should be canceled. Error: ${err.message}`,
                        ),
                    );
                })
                .finally(() => {
                    if (canceled) {
                        stream
                            .assign(TEST_LOG_FILE, {})
                            .then(() => {
                                search
                                    .search([
                                        {
                                            filter: 'warn',
                                            flags: { reg: true, word: false, cases: false },
                                        },
                                    ])
                                    .then((_) => {
                                        // search results available on rust side
                                        expect(typeof search.len()).toEqual('number');
                                        let result: IGrabbedElement[] | Error = search.grab(0, 10);
                                        if (result instanceof Error) {
                                            fail(`Fail to grab data due error: ${result.message}`);
                                            session.destroy();
                                            return done();
                                        }
                                        console.log(result);
                                        expect(result.length).toEqual(11);
                                        console.log(
                                            'result of grab was: ' +
                                                result.map((x) => x.content).join('\n'),
                                        );
                                        checkSessionDebugger(session);
                                        done();
                                    })
                                    .catch((err: Error) => {
                                        fail(err);
                                        done();
                                    })
                                    .finally(() => {
                                        session.destroy();
                                    });
                            })
                            .catch((err: Error) => {
                                fail(err);
                                done();
                            });
                    } else {
                        fail(new Error(`Finish achived, but operation wasn't canceled`));
                        session.destroy();
                        done();
                    }
                })
                .canceled(() => {
                    canceled = true;
                    // We do not continue test here as soon as we want also check triggering of
                    // "finally" state
                });
            setTimeout(() => {
                task.abort();
            }, 500);
        });
    
        it('Assign file & search and cancel search', function (done) {
            const session = new Session();
            // Set provider into debug mode
            session.debug(true);
            let canceled: boolean = false;
            const stream = session.getStream();
            const search = session.getSearch();
            if (stream instanceof Error) {
                fail(stream);
                return done();
            }
            if (search instanceof Error) {
                fail(search);
                return done();
            }
            stream
                .assign(TEST_LOG_FILE, {})
                .then(() => {
                    const task = search
                        .search([
                            {
                                filter: 'warn',
                                flags: { reg: true, word: false, cases: false },
                            },
                        ])
                        .then((_) => {
                            fail(new Error('Search is resolved, but it should be canceled'));
                        })
                        .catch((err: Error) => {
                            fail(err);
                            done();
                        })
                        .canceled(() => {
                            canceled = true;
                            // We do not continue test here as soon as we want also check triggering of
                            // "finally" state
                        })
                        .finally(() => {
                            if (canceled) {
                                // As soon as grabbing was calceled we should have len = 0 and calling
                                // native method should give us error (as soon as there are not inited grabber)
                                const len = search.len();
                                expect(len).toEqual(0);
                                expect(session.getNativeSession().getSearchLen()).toEqual(0);
                                checkSessionDebugger(session);
                            } else {
                                fail(new Error(`Finish achived, but operation wasn't canceled`));
                            }
                            session.destroy();
                            done();
                        });
                    setTimeout(() => {
                        task.abort();
                    }, 100);
                })
                .catch((err: Error) => {
                    fail(
                        new Error(
                            `Operation is rejected, but should be canceled. Error: ${err.message}`,
                        ),
                    );
                    session.destroy();
                    done();
                });
        });
    
        it('Assign file; search and cancel search; search again', function (done) {
            const session = new Session();
            // Set provider into debug mode
            session.debug(true);
            let canceled: boolean = false;
            const stream = session.getStream();
            const search = session.getSearch();
            if (stream instanceof Error) {
                fail(stream);
                return done();
            }
            if (search instanceof Error) {
                fail(search);
                return done();
            }
            stream
                .assign(TEST_LOG_FILE, {})
                .then(() => {
                    const task = search
                        .search([
                            {
                                filter: 'warn',
                                flags: { reg: true, word: false, cases: false },
                            },
                        ])
                        .then((_) => {
                            fail(new Error('Search is resolved, but it should be canceled'));
                        })
                        .catch((err: Error) => {
                            fail(err);
                            done();
                        })
                        .canceled(() => {
                            canceled = true;
                            // We do not continue test here as soon as we want also check triggering of
                            // "finally" state
                        })
                        .finally(() => {
                            if (canceled) {
                                // As soon as grabbing was calceled we should have len = 0 and calling
                                // native method should give us error (as soon as there are not inited grabber)
                                const len = search.len();
                                expect(len).toEqual(0);
                                expect(session.getNativeSession().getSearchLen()).toEqual(0);
                            } else {
                                fail(new Error(`Finish achived, but operation wasn't canceled`));
                                session.destroy();
                                return done();
                            }
                            search
                                .search([
                                    {
                                        filter: 'warn',
                                        flags: { reg: true, word: false, cases: false },
                                    },
                                ])
                                .then((_) => {
                                    // search results available on rust side
                                    expect(typeof search.len()).toEqual('number');
                                    let result: IGrabbedElement[] | Error = search.grab(0, 10);
                                    if (result instanceof Error) {
                                        fail(`Fail to grab data due error: ${result.message}`);
                                        session.destroy();
                                        return done();
                                    }
                                    console.log(result);
                                    expect(result.length).toEqual(11);
                                    console.log(
                                        'result of grab was: ' +
                                            result.map((x) => x.content).join('\n'),
                                    );
                                    checkSessionDebugger(session);
                                    done();
                                })
                                .catch((err: Error) => {
                                    fail(err);
                                    done();
                                })
                                .finally(() => {
                                    session.destroy();
                                });
                        });
                    setTimeout(() => {
                        task.abort();
                    }, 100);
                })
                .catch((err: Error) => {
                    fail(
                        new Error(
                            `Operation is rejected, but should be canceled. Error: ${err.message}`,
                        ),
                    );
                    session.destroy();
                    done();
                });
        });
    });
}

