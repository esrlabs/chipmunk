// tslint:disable

// We need to provide path to TypeScript types definitions
/// <reference path="../node_modules/@types/jasmine/index.d.ts" />
/// <reference path="../node_modules/@types/node/index.d.ts" />

// Manual start of defined test:
// ./node_modules/.bin/jasmine-ts src/something.spec.ts

// Get rid of default Jasmine timeout
// jasmine.DEFAULT_TIMEOUT_INTERVAL = 900000;

var addon = require('../native');

const LOCAL_EXAMPLE_DIR = `${require('os').homedir()}/tmp/logviewer_usecases`;
const HUGE_LOGFILE = `${LOCAL_EXAMPLE_DIR}/indexing/access_huge.log`;
const MID_LOGFILE = `${LOCAL_EXAMPLE_DIR}/indexing/access_mid.log`;
const SMALL_LOGFILE = `${LOCAL_EXAMPLE_DIR}/indexing/access_small.log`;

function foo() {
	console.log("foo");
}

// describe('EventHandler', function() {
// 	it('event emitter', function(done) {
// 		console.log('JS: starting test for event emitter');

// 		const grabber = new addon.GrabberHolder(SMALL_LOGFILE, function(cmd: string, data: any, data2: any) {
// 			if (cmd == addon.DONE) {
// 				let index = 0;
// 				let lines = grabber.grab(index, 5);
// 				console.log(`JS: lines: ${lines.length}`);
// 				lines.forEach((line: string) => {
// 					console.log(`${index}: ${line}`);
// 					index += 1;
// 				});
// 				index = 1000;
// 				let lines2 = grabber.grab(index, 5);
// 				console.log(`JS: lines2: ${lines2.length}`);
// 				lines2.forEach((line: string) => {
// 					console.log(`${index}: ${line}`);
// 					index += 1;
// 				});
// 				// release the underlying EventHandler
// 				console.log('JS: shuting down test emitter');
// 				grabber.shutdown();
// 				setTimeout(done);
// 			} else if (cmd == addon.PROGRESS) {
// 				let new_progress_percentage = (data as number / data2 as number * 100.0);
// 				if (new_progress_percentage > 98.0) {
// 					console.log('JS: got progress: ' + new_progress_percentage.toFixed(1));
// 				}
// 			} else {
// 				console.log(`invalid command: ${cmd}`);
// 			}
// 		});
// 		grabber.start();
// 		console.log('JS: exiting synchronous code execution');
// 	});
// });

describe('MockComputation', function() {
	it('full lifecycle should work', function(done) {

		let current_progress: number = 0.0;
		const computation = new addon.ComputationMock(function(cmd: string, data: any, data2: any) {
			if (cmd == addon.DONE) {
				console.log(`JS: Done`);
				expect(current_progress).toBeCloseTo(100.0);
				// release the underlying EventHandler
				computation.shutdown();
				setTimeout(done);
			} else if (cmd == addon.PROGRESS) {
				current_progress = (data as number / data2 as number * 100.0);
				console.log('JS: got progress: ' + current_progress.toFixed(1));
			} else {
				console.log(`JS: invalid command: ${cmd}`);
			}
		});
		computation.async_function();
		console.log('JS: exiting synchronous code execution');
	});

	it('shutdown should work', function(done) {

		let shutdown_called = false;
		const computation = new addon.ComputationMock(function(cmd: string, data: any, data2: any) {
			if (cmd == addon.DONE) {
				console.log(`JS: Done`);
				expect(shutdown_called).toBe(true);
				setTimeout(done);
			} else if (cmd == addon.PROGRESS) {
				expect(shutdown_called).toBe(false);
				let current_progress = (data as number / data2 as number * 100.0);
				console.log('JS: got progress: ' + current_progress.toFixed(1));
				// now call shutdown to interrupt the operation
				computation.shutdown();
				shutdown_called = true;
			} else if (cmd == addon.PROGRESS) {
				console.log(`JS: got a notification: ${data}`);
			} else {
				console.log(`JS: invalid command: ${cmd}`);
			}
		});
		computation.async_function();
		console.log('JS: exiting synchronous code execution');
	});
});
