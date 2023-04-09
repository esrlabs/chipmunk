// tslint:disable

// We need to provide path to TypeScript types definitions
/// <reference path="../node_modules/@types/jasmine/index.d.ts" />
/// <reference path="../node_modules/@types/node/index.d.ts" />
import { initLogger } from './logger';
initLogger();
import { finish } from './common';
import { readConfigurationFile } from './config';
import { CancelablePromise } from 'platform/env/promise';

const config = readConfigurationFile().get().tests.promises;

function ingore(id: string | number, done: () => void) {
    if (
        config.regular.execute_only.length > 0 &&
        config.regular.execute_only.indexOf(typeof id === 'number' ? id : parseInt(id, 10)) === -1
    ) {
        console.log(`"${config.regular.list[id]}" is ignored`);
        done();
        return true;
    } else {
        return false;
    }
}

describe('Promises', function () {
    it(config.regular.list[1], function (done) {
        if (ingore(1, done)) {
            return;
        }
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

    it(config.regular.list[2], function (done) {
        if (ingore(2, done)) {
            return;
        }
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

    it(config.regular.list[3], function (done) {
        if (ingore(3, done)) {
            return;
        }
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

    it(config.regular.list[4], function (done) {
        if (ingore(4, done)) {
            return;
        }
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

    it(config.regular.list[5], function (done) {
        if (ingore(5, done)) {
            return;
        }
        let resolved = 0;
        let rejected = 0;
        const a = new CancelablePromise((resolve, reject) => {
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

    it(config.regular.list[6], function (done) {
        if (ingore(6, done)) {
            return;
        }
        let resolved = 0;
        let rejected = 0;
        let canceled = 0;
        const a = new CancelablePromise((resolve, reject, cancel) => {
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

    it(config.regular.list[7], function (done) {
        if (ingore(7, done)) {
            return;
        }
        let resolved = 0;
        let rejected = 0;
        let canceled = 0;
        let delegated = false;
        const a = new CancelablePromise((resolve, reject, cancel, setCancelDelegation) => {
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
