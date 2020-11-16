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
// Yeu have to resolve it by hands. Open "./application/apps/indexer-neon/node_modules/ts-node/package.json"
// Add there ("./dist": "./dist/index.js") into "exports" sections. Like this:
//
// "exports": {
//     ".": "./dist/index.js",
//     "./dist": "./dist/index.js",
//     ...
// }

// Get rid of default Jasmine timeout
jasmine.DEFAULT_TIMEOUT_INTERVAL = 900000;

import * as Events from '../src/util/events';

import { RustChannelRequiered } from '../src/native/native.channel.required';
import { EventsSignatures } from '../src/api/сomputation';
import { Computation } from '../src/api/сomputation';

class DummyRustChannel extends RustChannelRequiered {

    private _shutdown: boolean = false;
    private _stopped: boolean = false;
    private _error?: Error;

    constructor(selfTerminationAfter?: number, error?: Error) {
        super();
        if (typeof selfTerminationAfter === 'number') {
            setTimeout(() => {
                this.shutdown();
            }, selfTerminationAfter);
        }
        if (error instanceof Error) {
            setTimeout(() => {
                this._error = error;
            }, 200);
        }
    }

    public poll(callback: (
        err: string | undefined | null,
        event: string | undefined | null,
        args: { [key: string]: any } | undefined | null) => void): void {
        if (this._stopped) {
            return;
        }
        if (this._shutdown) {
            this._stopped = true;
            return callback(null, EventsSignatures.destroyed, null);
        }
        if (this._error instanceof Error) {
            callback(this._error.message, undefined, undefined);
            return this._error = undefined;
        }
        callback(undefined, undefined, undefined);
    }

    public shutdown(): void {
        this._shutdown = true;
    }

}

interface IEvents {
    error: Events.Subject<Error>,
    destroyed: Events.Subject<void>,
}

interface IEventsSignatures {
    error: 'error';
    destroyed: 'destroyed';
};

const EventsInterface = {
    error: { self: Error },
    destroyed: { self: null },
};

class DummyComputation extends Computation<IEvents> {

    private readonly _events: IEvents = {
        error: new Events.Subject<Error>(),
        destroyed: new Events.Subject<void>(),
    };

    constructor(channel: DummyRustChannel, uuid: string) {
        super(channel, uuid);
    }

    public getName(): string {
        return 'DummyComputation';
    }

    public getEvents(): IEvents {
        return this._events;
    }

    public getEventsSignatures(): IEventsSignatures {
        return {
            error: 'error',
            destroyed: 'destroyed',
        };
    }

    public getEventsInterfaces() {
        return EventsInterface;
    }


}


describe('Iterfaces testsComputation Events Life Circle', () => {

    it('Call destroy', (done: Function)=> {
        const channel: DummyRustChannel = new DummyRustChannel();
        const computation: DummyComputation = new DummyComputation(channel, 'a');
        let destroyed: boolean = false;
        let error: boolean = false;
        computation.getEvents().destroyed.subscribe(() => {
            destroyed = true;
        });
        computation.getEvents().error.subscribe(() => {
            error = true;
        });
        computation.destroy().then(() => {
            expect(destroyed).toBe(true);
            expect(error).toBe(false);
        }).catch((err) => {
            console.log(err);
            expect(true).toBe(false);
        }).finally(() => {
            done();
        });
    });

    it('Self termination', (done: Function)=> {
        const channel: DummyRustChannel = new DummyRustChannel(250);
        const computation: DummyComputation = new DummyComputation(channel, 'a');
        let destroyed: boolean = false;
        let error: boolean = false;
        computation.getEvents().destroyed.subscribe(() => {
            destroyed = true;
        });
        computation.getEvents().error.subscribe(() => {
            error = true;
        });
        setTimeout(() => {
            expect(destroyed).toBe(true);
            expect(error).toBe(false);
            done();
        }, 500);
    });

    it('Self termination & error', (done: Function)=> {
        const channel: DummyRustChannel = new DummyRustChannel(750, new Error('Test'));
        const computation: DummyComputation = new DummyComputation(channel, 'a');
        let destroyed: boolean = false;
        let error: boolean = false;
        computation.getEvents().destroyed.subscribe(() => {
            destroyed = true;
        });
        computation.getEvents().error.subscribe(() => {
            error = true;
        });
        setTimeout(() => {
            expect(destroyed).toBe(true);
            expect(error).toBe(true);
            done();
        }, 1000);
    });

    it('Attempt to destroy more than once', (done: Function)=> {
        const channel: DummyRustChannel = new DummyRustChannel(250);
        const computation: DummyComputation = new DummyComputation(channel, 'a');
        let destroyed: boolean = false;
        let error: boolean = false;
        computation.getEvents().destroyed.subscribe(() => {
            destroyed = true;
        });
        computation.getEvents().error.subscribe(() => {
            error = true;
        });
        setTimeout(() => {
            computation.destroy().then(() => {
                expect(false).toBe(true);
            }).catch((err: Error) => {
                expect(destroyed).toBe(true);
                expect(error).toBe(false);    
            }).finally(() => {
                done();
            });
        }, 500);
    });


});
