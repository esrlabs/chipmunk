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

describe('EventHandler', function() {
	it('event emitter', function(done) {
		console.log('JS: starting test for event emitter');
		const grabber = new addon.GrabberHolder(HUGE_LOGFILE, function(cmd: string) {
			console.log('JS: in callback, cmd=', cmd);
			if (cmd == 'done') {
				let index = 0;
				let lines = grabber.grab(index, 5);
				console.log(`JS: lines: ${lines.length}`);
				lines.forEach((line: string) => {
					console.log(`${index}: ${line}`);
					index += 1;
				});
				index = 1000;
				let lines2 = grabber.grab(index, 5);
				console.log(`JS: lines2: ${lines2.length}`);
				lines2.forEach((line: string) => {
					console.log(`${index}: ${line}`);
					index += 1;
				});
				// release the underlying EventHandler
				console.log('JS: shuting down test emitter');
				grabber.shutdown();
				setTimeout(done);
			} else {
				console.log('invalid command');
			}
		});
		grabber.start();
		console.log('JS: exiting synchronous code execution');
	});
});
