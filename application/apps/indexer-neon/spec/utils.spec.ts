// tslint:disable

// We need to provide path to TypeScript types definitions
/// <reference path="../node_modules/@types/jasmine/index.d.ts" />
/// <reference path="../node_modules/@types/node/index.d.ts" />

// Manual start of defined test:
// ./node_modules/.bin/jasmine-ts src/something.spec.ts

// If you have error like next:
//
// Error [ERR_PACKAGE_PATH_NOT_EXPORTED]: Package subpath './dist' is not defined by "exports" in ./application/apps/indexer-neon/node_modules/ts-node/package.json
//
// You have to resolve it by hands. Open "./application/apps/indexer-neon/node_modules/ts-node/package.json"
// Add there ("./dist": "./dist/index.js") into "exports" sections. Like this:
//
// "exports": {
//     ".": "./dist/index.js",
//     "./dist": "./dist/index.js",
//     ...
// }

// Get rid of default Jasmine timeout
jasmine.DEFAULT_TIMEOUT_INTERVAL = 900000;

import { Subject, IEventDesc } from '../src/util/events.subject';
import { CancelablePromise } from '../src/util/promise';
import { PromiseExecutor } from '../src/util/promise.executor';

describe('Utils tests', () => {

    it('Subject interface validator', (done: Function)=> {
        
        let desc: IEventDesc = { self: 'object', propA: 'string', propB: 'number' };
        expect(Subject.validate(desc, { propA: 'this is string', propB: 1 })).toBe(undefined);
        expect(Subject.validate(desc, { propA: 'this is string', propB: '1' })).toBeInstanceOf(Error);

        desc = { self: 'object', propA: 'string', propB: ['number', 'string'] };
        expect(Subject.validate(desc, { propA: 'this is string', propB: 1 })).toBe(undefined);
        expect(Subject.validate(desc, { propA: 'this is string', propB: '1' })).toBe(undefined);
        
        desc = { self: Error };
        expect(Subject.validate(desc, new Error('Test'))).toBe(undefined);
        expect(Subject.validate(desc, {  })).toBeInstanceOf(Error);

        desc = { self: null };
        expect(Subject.validate(desc, undefined)).toBe(undefined);
        expect(Subject.validate(desc, null)).toBe(undefined);
        expect(Subject.validate(desc, {  })).toBeInstanceOf(Error);

        desc = { self: 'object', error: [Error, 'undefined'] };
        expect(Subject.validate(desc, { error: undefined })).toBe(undefined);
        expect(Subject.validate(desc, { error: new Error('Test') })).toBe(undefined);
        expect(Subject.validate(desc, { error: 'Test' })).toBeInstanceOf(Error);

        done();
    });

    it('Promises: cancel previous', (done: Function)=> {
        const results = {
            resolved: 0,
            canceled: 0,
        };
        const executor: PromiseExecutor<number> = new PromiseExecutor();
        // This task should be canceled
        executor.run(() => new CancelablePromise((resolve, reject, cancel, cancelRef, self) => {
            self.canceled(() => {
                
                clearTimeout(timer);
            });
            const timer = setTimeout(() => {
                results.resolved += 1;
                resolve(results.resolved);
                expect(true).toBe(false);
            }, 250);
        })).then(() => {
            expect(true).toBe(false);     
        }).catch((err: Error) => {
            expect(true).toBe(false);
        }).canceled(() => {
            results.canceled += 1;
            
        });
        // This task should be canceled
        executor.run(() => new CancelablePromise((resolve, reject, cancel, cancelRef, self) => {
            self.canceled(() => {
                
                clearTimeout(timer);
            });
            const timer = setTimeout(() => {
                results.resolved += 1;
                resolve(results.resolved);
                expect(true).toBe(false);
            }, 250);
        })).then(() => {
            expect(true).toBe(false);     
        }).catch((err: Error) => {
            expect(true).toBe(false);
        }).canceled(() => {
            results.canceled += 1;
            
        });
        // This task should be done
        executor.run(() => new CancelablePromise((resolve, reject, cancel, cancelRef, self) => {
            self.canceled(() => {
                expect(true).toBe(false);
                clearTimeout(timer);
            });
            const timer = setTimeout(() => {
                results.resolved += 1;
                resolve(results.resolved);
                expect(results.resolved).toBe(1);
            }, 250);
        })).then(() => {
            expect(executor.getStat().done).toBe(1);
            expect(executor.getStat().canceled).toBe(2);
            expect(executor.getStat().actual).toBe(1);
            expect(executor.getStat().rejected).toBe(0);
            expect(results.resolved).toBe(1);
            expect(results.canceled).toBe(2);
            done();        
        }).catch((err: Error) => {
            expect(true).toBe(false);
        }).canceled(() => {
            expect(true).toBe(false);
        });

    });

    it('Promises: abort all', (done: Function)=> {
        const results = {
            resolved: 0,
            canceled: 0,
        };
        const executor: PromiseExecutor<number> = new PromiseExecutor();
        // This task should be canceled
        executor.run(() => new CancelablePromise((resolve, reject, cancel, cancelRef, self) => {
            self.canceled(() => {
                
                clearTimeout(timer);
            });
            const timer = setTimeout(() => {
                results.resolved += 1;
                resolve(results.resolved);
                expect(true).toBe(false);
            }, 250);
        })).then(() => {
            expect(true).toBe(false);     
        }).catch((err: Error) => {
            expect(true).toBe(false);
        }).canceled(() => {
            results.canceled += 1;
            
        });
        // This task should be canceled
        executor.run(() => new CancelablePromise((resolve, reject, cancel, cancelRef, self) => {
            self.canceled(() => {
                
                clearTimeout(timer);
            });
            const timer = setTimeout(() => {
                results.resolved += 1;
                resolve(results.resolved);
                expect(true).toBe(false);
            }, 250);
        })).then(() => {
            expect(true).toBe(false);     
        }).catch((err: Error) => {
            expect(true).toBe(false);
        }).canceled(() => {
            results.canceled += 1;
            
        });
        // This task should be canceled
        executor.run(() => new CancelablePromise((resolve, reject, cancel, cancelRef, self) => {
            self.canceled(() => {
                
                clearTimeout(timer);
            });
            const timer = setTimeout(() => {
                results.resolved += 1;
                resolve(results.resolved);
                expect(results.resolved).toBe(0);
            }, 250);
        })).then(() => {
            expect(true).toBe(false);     
        }).catch((err: Error) => {
            expect(true).toBe(false);
        }).canceled(() => {
            results.canceled += 1;
            
        });
        // Cancel all task
        executor.abort().then(() => {
            expect(executor.getStat().done).toBe(0);
            expect(executor.getStat().canceled).toBe(3);
            expect(executor.getStat().actual).toBe(0);
            expect(executor.getStat().rejected).toBe(0);
            expect(results.resolved).toBe(0);
            expect(results.canceled).toBe(3);
            done();        
        }).catch((err: Error) => {
            expect(true).toBe(false);
        });
    });

    it('Promises: abort all; cancel with delay', (done: Function)=> {
        const results = {
            resolved: 0,
            canceled: 0,
        };
        const executor: PromiseExecutor<number> = new PromiseExecutor();
        // This task should be canceled
        executor.run(() => new CancelablePromise((resolve, reject, cancel, cancelRef, self) => {
            self.canceled(() => {
                clearTimeout(timer);
            });
            const timer = setTimeout(() => {
                results.resolved += 1;
                resolve(results.resolved);
                expect(true).toBe(false);
            }, 250);
        })).then(() => {
            expect(true).toBe(false);     
        }).catch((err: Error) => {
            expect(true).toBe(false);
        }).canceled(() => {
            results.canceled += 1;
        });
        // This task should be canceled
        executor.run(() => new CancelablePromise((resolve, reject, cancel, cancelRef, self) => {
            self.canceled(() => {
                clearTimeout(timer);
            });
            const timer = setTimeout(() => {
                results.resolved += 1;
                resolve(results.resolved);
                expect(true).toBe(false);
            }, 250);
        })).then(() => {
            expect(true).toBe(false);     
        }).catch((err: Error) => {
            expect(true).toBe(false);
        }).canceled(() => {
            results.canceled += 1;
            
        });
        // This task should be canceled
        executor.run(() => new CancelablePromise((resolve, reject, cancel, cancelRef, self) => {
            cancelRef(() => {
                clearTimeout(timer);
                setTimeout(() => {
                    results.canceled += 1;
                    // Cancel task with delay
                    cancel();
                }, 500);
            });
            self.canceled(() => {
                
                clearTimeout(timer);
            });
            const timer = setTimeout(() => {
                results.resolved += 1;
                resolve(results.resolved);
                expect(results.resolved).toBe(0);
            }, 250);
        })).then(() => {
            expect(true).toBe(false);     
        }).catch((err: Error) => {
            expect(true).toBe(false);
        }).canceled(() => {
            
        });
        setTimeout(() => {
            // Cancel all task
            executor.abort().then(() => {
                expect(results.resolved).toBe(0);
                expect(results.canceled).toBe(3);
                expect(executor.getStat().done).toBe(0);
                expect(executor.getStat().canceled).toBe(3);
                expect(executor.getStat().actual).toBe(0);
                expect(executor.getStat().rejected).toBe(0);
                done();
            });
        }, 100);
    });

});
