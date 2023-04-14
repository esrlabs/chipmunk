// tslint:disable

// We need to provide path to TypeScript types definitions
/// <reference path="../node_modules/@types/jasmine/index.d.ts" />
/// <reference path="../node_modules/@types/node/index.d.ts" />
import { initLogger } from './logger';
initLogger();
import { finish, runner } from './common';
import { readConfigurationFile } from './config';
import { CancelablePromise } from 'platform/env/promise';

const config = readConfigurationFile().get().tests.promises;

describe('Promises', function () {
    it(config.regular.list[1], function () {
        return runner(config.regular, 1, async (logger, done, collector) => {
            let resolved = 0;
            let rejected = 0;
            Promise.allSettled([
                new CancelablePromise((resolve, _reject) => {
                    setTimeout(resolve, 50);
                })
                    .then(() => {
                        resolved += 1;
                    })
                    .asPromise(),
                new CancelablePromise((_resolve, reject) => {
                    setTimeout(() => {
                        reject(new Error(`Dummy error`));
                    }, 50);
                })
                    .catch(() => {
                        rejected += 1;
                    })
                    .asPromise(),
            ])
                .then(() => {
                    expect(resolved).toBe(1);
                    expect(rejected).toBe(1);
                    finish(undefined, done, undefined);
                })
                .catch((err: Error) => {
                    finish(undefined, done, err);
                });
        });
    });

    it(config.regular.list[2], function () {
        return runner(config.regular, 2, async (logger, done, collector) => {
            new CancelablePromise((_resolve, reject) => {
                setTimeout(() => {
                    reject(new Error(`Dummy error`));
                }, 50);
            })

                .catch((err: Error) => {
                    finish(undefined, done, err);
                })
                .then(() => {
                    finish(undefined, done, new Error(`Promise should be cancelled`));
                })
                .canceled(() => {
                    // Set timer to make sure - promise ONLY cancelled
                    setTimeout(() => {
                        finish(undefined, done, undefined);
                    }, 100);
                })
                .abort();
        });
    });

    it(config.regular.list[3], function () {
        return runner(config.regular, 3, async (logger, done, collector) => {
            let delegated = false;
            new CancelablePromise((_resolve, reject, cancel, setCancelDelegation) => {
                setCancelDelegation(() => {
                    setTimeout(() => {
                        delegated = true;
                        cancel();
                    }, 100);
                });
                setTimeout(() => {
                    reject(new Error(`Dummy error`));
                }, 50);
            })
                .catch((err: Error) => {
                    finish(undefined, done, err);
                })
                .then(() => {
                    finish(undefined, done, new Error(`Promise should be cancelled`));
                })
                .canceled(() => {
                    // Set timer to make sure - promise ONLY cancelled
                    setTimeout(() => {
                        expect(delegated).toBe(true);
                        finish(undefined, done, undefined);
                    }, 100);
                })
                .abort();
        });
    });

    it(config.regular.list[4], function () {
        return runner(config.regular, 4, async (logger, done, collector) => {
            let resolved = 0;
            let rejected = 0;
            const a = new CancelablePromise((resolve, _reject) => {
                setTimeout(resolve, 50);
            })
                .then(() => {
                    resolved += 1;
                })
                .catch(() => {
                    rejected += 1;
                });
            const b = new CancelablePromise((_resolve, _reject) => {})
                .then(() => {
                    resolved += 1;
                })
                .catch(() => {
                    rejected += 1;
                });
            a.bind(b);
            Promise.allSettled([a.asPromise(), b.asPromise()])
                .then(() => {
                    expect(resolved).toBe(2);
                    expect(rejected).toBe(0);
                    finish(undefined, done, undefined);
                })
                .catch((err: Error) => {
                    finish(undefined, done, err);
                });
        });
    });

    it(config.regular.list[5], function () {
        return runner(config.regular, 5, async (logger, done, collector) => {
            let resolved = 0;
            let rejected = 0;
            const a = new CancelablePromise((_resolve, reject) => {
                setTimeout(() => {
                    reject(new Error('Dummy error'));
                }, 50);
            })
                .then(() => {
                    resolved += 1;
                })
                .catch(() => {
                    rejected += 1;
                });
            const b = new CancelablePromise((_resolve, _reject) => {})
                .then(() => {
                    resolved += 1;
                })
                .catch(() => {
                    rejected += 1;
                });
            b.bind(a);
            Promise.allSettled([a.asPromise(), b.asPromise()])
                .then(() => {
                    expect(resolved).toBe(0);
                    expect(rejected).toBe(2);
                    finish(undefined, done, undefined);
                })
                .catch((err: Error) => {
                    finish(undefined, done, err);
                });
        });
    });

    it(config.regular.list[6], function () {
        return runner(config.regular, 6, async (logger, done, collector) => {
            let resolved = 0;
            let rejected = 0;
            let canceled = 0;
            const a = new CancelablePromise((_resolve, _reject, cancel) => {
                setTimeout(cancel, 50);
            })
                .then(() => {
                    resolved += 1;
                })
                .canceled(() => {
                    canceled += 1;
                })
                .catch(() => {
                    rejected += 1;
                });
            const b = new CancelablePromise((_resolve, _reject) => {})
                .then(() => {
                    resolved += 1;
                })
                .canceled(() => {
                    canceled += 1;
                })
                .catch(() => {
                    rejected += 1;
                });
            a.bind(b);
            Promise.allSettled([a.asPromise(), b.asPromise()])
                .then(() => {
                    expect(resolved).toBe(0);
                    expect(canceled).toBe(2);
                    expect(rejected).toBe(0);
                    finish(undefined, done, undefined);
                })
                .catch((err: Error) => {
                    finish(undefined, done, err);
                });
        });
    });

    it(config.regular.list[7], function () {
        return runner(config.regular, 7, async (logger, done, collector) => {
            let resolved = 0;
            let rejected = 0;
            let canceled = 0;
            let delegated = false;
            const a = new CancelablePromise((_resolve, _reject, cancel, setCancelDelegation) => {
                setCancelDelegation(() => {
                    setTimeout(() => {
                        delegated = true;
                        cancel();
                    }, 100);
                });
            })
                .then(() => {
                    resolved += 1;
                })
                .canceled(() => {
                    canceled += 1;
                })
                .catch(() => {
                    rejected += 1;
                });
            const b = new CancelablePromise((_resolve, _reject) => {})
                .then(() => {
                    resolved += 1;
                })
                .canceled(() => {
                    canceled += 1;
                })
                .catch(() => {
                    rejected += 1;
                });
            a.bind(b);
            setTimeout(() => {
                b.abort();
            }, 50);
            Promise.allSettled([a.asPromise(), b.asPromise()])
                .then(() => {
                    expect(resolved).toBe(0);
                    expect(canceled).toBe(2);
                    expect(rejected).toBe(0);
                    expect(delegated).toBe(true);
                    finish(undefined, done, undefined);
                })
                .catch((err: Error) => {
                    finish(undefined, done, err);
                });
        });
    });

    it(config.regular.list[8], function () {
        return runner(config.regular, 8, async (logger, done, collector) => {
            let resolved = 0;
            let rejected = 0;
            let canceled = 0;
            let emitted = 0;
            let delegated = false;
            const a = new CancelablePromise(
                (_resolve, _reject, cancel, setCancelDelegation, self) => {
                    setCancelDelegation(() => {
                        setTimeout(() => {
                            delegated = true;
                            cancel();
                        }, 100);
                    });
                },
            )
                .then(() => {
                    resolved += 1;
                })
                .canceled(() => {
                    canceled += 1;
                })
                .catch(() => {
                    rejected += 1;
                })
                .on('test', (event) => {
                    expect(event).toBe(42);
                    emitted += 1;
                });
            a.emit('test', 42);
            const b = new CancelablePromise((_resolve, _reject) => {})
                .then(() => {
                    resolved += 1;
                })
                .canceled(() => {
                    canceled += 1;
                })
                .catch(() => {
                    rejected += 1;
                })
                .on('test', (event) => {
                    expect(event).toBe(42);
                    emitted += 1;
                });
            a.bind(b);
            setTimeout(() => {
                b.abort();
            }, 50);
            Promise.allSettled([a.asPromise(), b.asPromise()])
                .then(() => {
                    // This event should ignored, because promise already finished
                    a.emit('test', 42);
                    b.emit('test', 42);
                    // Check results with delay to make sure nothing useless happens
                    setTimeout(() => {
                        expect(resolved).toBe(0);
                        expect(canceled).toBe(2);
                        expect(rejected).toBe(0);
                        expect(emitted).toBe(1);
                        expect(delegated).toBe(true);
                        finish(undefined, done, undefined);
                    }, 100);
                })
                .catch((err: Error) => {
                    finish(undefined, done, err);
                });
        });
    });
});
