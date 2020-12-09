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
var addon = require('../native');

// Get rid of default Jasmine timeout
jasmine.DEFAULT_TIMEOUT_INTERVAL = 900000;

import * as Events from '../src/util/events';

import { RustChannelRequiered } from '../src/native/native.channel.required';
import { RustChannelConstructorImpl, TEventEmitter, ERustEmitterEvents } from '../src/native/native';

import { Computation } from '../src/api/сomputation';
import {
	IEventsInterfaces,
	EventsInterfaces,
	EventsSignatures,
	IEventsSignatures,
	IEvents,
	IOperationProgress
} from '../src/interfaces/computation.minimal.withprogress';
import { IComputationError, EErrorSeverity } from '../src/interfaces/errors';

class DummyRustChannel extends RustChannelRequiered {
	private _destroyed: boolean = false;
	private _emitter: TEventEmitter;

	constructor(emitter: TEventEmitter, selfTerminationAfter?: number, error?: IComputationError) {
		super();
		this._emitter = emitter;
		if (typeof selfTerminationAfter === 'number') {
			setTimeout(() => {
				this.destroy();
			}, selfTerminationAfter);
		}
		if (error !== undefined) {
			setTimeout(() => {
				this._emitter(ERustEmitterEvents.error, error);
			}, 200);
		}
	}

	public destroy(): void {
		if (this._destroyed) {
			return;
		}
		this._destroyed = true;
		this._emitter(ERustEmitterEvents.destroyed, undefined);
	}
}

// Check also correct type declaration binding
let DummyRustChannelConstructor: RustChannelConstructorImpl<DummyRustChannel> = DummyRustChannel;

class DummyComputation extends Computation<IEvents> {
	private readonly _events: IEvents = {
		progress: new Events.Subject<IOperationProgress>(),
		error: new Events.Subject<IComputationError>(),
		destroyed: new Events.Subject<void>()
	};

	constructor(uuid: string) {
		super(uuid);
	}

	public getName(): string {
		return 'DummyComputation';
	}

	public getEvents(): IEvents {
		return this._events;
	}

	public getEventsSignatures(): IEventsSignatures {
		return EventsSignatures;
	}

	public getEventsInterfaces(): IEventsInterfaces {
		return EventsInterfaces;
	}
}

describe('Iterfaces testsComputation Events Life Circle', () => {
	it('Call destroy', (done: Function) => {
		const computation: DummyComputation = new DummyComputation('a');
		const channel: DummyRustChannel = new DummyRustChannelConstructor(computation.getEmitter());
		let destroyed: boolean = false;
		let error: boolean = false;
		computation.getEvents().destroyed.subscribe(() => {
			destroyed = true;
		});
		computation.getEvents().error.subscribe(() => {
			error = true;
		});
		channel.destroy();
		setTimeout(() => {
			expect(destroyed).toBe(true);
			expect(error).toBe(false);
			done();
		}, 500);
	});

	it('Self termination', (done: Function) => {
		const computation: DummyComputation = new DummyComputation('a');
		const channel: DummyRustChannel = new DummyRustChannel(computation.getEmitter(), 250);
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

	it('Self termination & error', (done: Function) => {
		const computation: DummyComputation = new DummyComputation('a');
		const channel: DummyRustChannel = new DummyRustChannel(computation.getEmitter(), 750, {
			message: 'Test for Error',
			severity: EErrorSeverity.error
		});
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

	it('Attempt to destroy more than once', (done: Function) => {
		const computation: DummyComputation = new DummyComputation('a');
		const channel: DummyRustChannel = new DummyRustChannel(computation.getEmitter(), 250);
		let destroyed: boolean = false;
		let error: boolean = false;
		computation.getEvents().destroyed.subscribe(() => {
			destroyed = true;
		});
		computation.getEvents().error.subscribe(() => {
			error = true;
		});
		setTimeout(() => {
			computation
				.destroy()
				.then(() => {
					fail(`Computation is resolved, but expectation: computation would be rejected`);
				})
				.catch((err: Error) => {
					expect(destroyed).toBe(true);
					expect(error).toBe(false);
				})
				.finally(() => {
					done();
				});
		}, 500);
	});
});

describe('MockComputation', function() {
	it('full lifecycle should work', function(done) {
        let current_progress: number = 0.0;
        const session_id = "Mock-Session-1";
        const session = new addon.Session(session_id);
        session.add_operation('MOCK', '', '', function(cmd: string, data: any, data2: any) {
			if (cmd == addon.DONE) {
				console.log(`JS: Done`);
				expect(current_progress).toBeCloseTo(100.0);
				// release the underlying EventHandler
				session.shutdown_operation('MOCK');
				setTimeout(done);
			} else if (cmd == addon.PROGRESS) {
				current_progress = (((data as number) / data2) as number) * 100.0;
				console.log('JS: got progress: ' + current_progress.toFixed(1));
			} else {
				console.log(`JS: invalid command: ${cmd}`);
			}
		});
		session.async_function('MOCK');
		console.log('JS: exiting synchronous code execution');
	});

	it('shutdown should work', function(done) {
		let shutdown_called = false;
        const session_id = "Mock-Session-1";
        const operation_id = "MOCK";
        const session = new addon.Session(session_id);
        session.add_operation(operation_id, '', '', function(cmd: string, data: any, data2: any) {
			if (cmd == addon.DONE) {
				console.log(`JS: Done`);
				expect(shutdown_called).toBe(true);
				setTimeout(done);
			} else if (cmd == addon.PROGRESS) {
				expect(shutdown_called).toBe(false);
				let current_progress = (((data as number) / data2) as number) * 100.0;
				console.log('JS: got progress: ' + current_progress.toFixed(1));
				// now call shutdown to interrupt the operation
				session.shutdown_operation(operation_id);
				shutdown_called = true;
			} else if (cmd == addon.PROGRESS) {
				console.log(`JS: got a notification: ${data}`);
			} else {
				console.log(`JS: invalid command: ${cmd}`);
			}
		});
		session.async_function(operation_id);
		console.log('JS: exiting synchronous code execution');
	});
});

describe('GrabberComputation', function() {
	it('basic example should work', function(done) {
		const tmp = require('tmp');
		const fs = require('fs');

		const tmpobj = tmp.fileSync();

		console.log(`Create example grabber file`);
		for (let i = 0; i < 1000; i++) {
			fs.appendFileSync(tmpobj.name, `some line data: ${i}\n`);
		}
		var stats = fs.statSync(tmpobj.name);
		console.log(`file-size: ${stats.size}`);

		let current_progress: number = 0.0;
        const session_id = "Mock-Session-1";
        const operation_id = "GRABBER";
        const session = new addon.Session(session_id);

		session.add_operation(operation_id, tmpobj.name, '', function(
			event: string,
			data: any,
			data2: any
		) {
			if (event == addon.DONE) {
                const result_value = data as string;
				console.log(`JS: Done, result_value: ${result_value}`);
				expect(current_progress).toBeCloseTo(100.0);
				let result = session.sync_function(operation_id, 500, 7);
				console.log(`sync result: ${result}`);
				expect(result).toEqual([
					'some line data: 500',
					'some line data: 501',
					'some line data: 502',
					'some line data: 503',
					'some line data: 504',
					'some line data: 505',
					'some line data: 506'
				]);

				// release the underlying EventHandler
				session.shutdown_operation(operation_id);
				tmpobj.removeCallback();
				setTimeout(done);
			} else if (event == addon.STOPPED) {
			} else if (event == addon.PROGRESS) {
				current_progress = (((data as number) / data2) as number) * 100.0;
				console.log('JS: got progress: ' + current_progress.toFixed(1));
			} else {
				console.log(`JS: invalid command: ${event}`);
			}
		});
		session.async_function(operation_id);
		console.log('JS: exiting synchronous code execution');
	});
});
