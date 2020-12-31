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
var path = require('path');
import { RustSession } from '../src/api/session';
import { RustSessionChannelConstructor } from '../src/native';
import { ISearchFilter, IGrabbedContent } from '../src/interfaces/index';
// import { RustSessionChannelConstructor, RustSessionChannel } from '../src/native/native.session';

// Get rid of default Jasmine timeout
jasmine.DEFAULT_TIMEOUT_INTERVAL = 900000;

describe('Session', function() {
	it('basic session support', function(done) {
		const session_id = 'Rust-Session-1';
		// const session: RustSessionChannel = new RustSessionChannelConstructor(session_id, function(event: string) {
		const session = new RustSession(session_id, function(eventString: string) {
			console.log('JS: received event: ' + eventString);
			const event = JSON.parse(eventString);
			console.log('JS: received event, keys: ' + Object.keys(event));
			if (event.hasOwnProperty('Progress')) {
				console.log('was progress');
			}
			done();
		});
		console.log('created session');
		expect(session.id()).toEqual(session_id);
		let filterA = {
			value: 'Bluetooth',
			is_regex: true,
			case_sensitive: false,
			is_word: false
		};
		let filterB = {
			value: 'Warning',
			is_regex: true,
			case_sensitive: false,
			is_word: false
		};
		session.setSearch([ filterA ]);
		console.log('filters:' + JSON.stringify(session.getFilters()));
		session.setSearch([ filterB ]);
		console.log('filters:' + JSON.stringify(session.getFilters()));
		session.clearSearch();
		console.log('filters:' + JSON.stringify(session.getFilters()));
		session.destroy();
	});
});

function createSampleFile(lines: number) {
	const tmp = require('tmp');
	const fs = require('fs');

	const tmpobj = tmp.fileSync();

	console.log(`Create example grabber file`);
	for (let i = 0; i < lines; i++) {
		fs.appendFileSync(tmpobj.name, `some line data: ${i}\n`);
	}
	var stats = fs.statSync(tmpobj.name);
	console.log(`file-size: ${stats.size}`);
	return tmpobj;
}
function sleep(ms: number) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

enum EventType {
	Progress,
	Done,
	Other
}

function parseEventType(eventString: string): EventType {
	const event = JSON.parse(eventString);
	console.log('JS: received event, keys: ' + Object.keys(event));
	if (event.hasOwnProperty('Progress')) {
		return EventType.Progress;
	}
	if (event.hasOwnProperty('Done')) {
		return EventType.Done;
	}
	return EventType.Other;
}

enum ProgressType {
	Ticks,
	Stopped,
	Notification
}
enum Severity {
	Warning,
	Error
}
interface Notification {
	severity: Severity;
	content: string;
	line?: number;
}
interface Ticks {
	count: number;
	total: number;
}

interface Stopped {}
interface Progress {
	content: Ticks | Notification | Stopped;
}

function parseTicks(eventString: string): Ticks | undefined {
	const event = JSON.parse(eventString);
	if (event.Progress.type == 'Ticks') {
		const ticks = { count: event.Progress.count, total: event.Progress.total } as Ticks;
		return ticks;
	}
	return undefined;
}

describe('MockComputation', function() {
	it('full lifecycle should work', (done) => {
		let tmpobj = createSampleFile(5000);
		let tmpFilePath = tmpobj.name;
		const session_id = 'Rust-Session-1';
		const session = new RustSession(session_id, async function(eventString: string) {
			switch (+parseEventType(eventString)) {
				case EventType.Progress:
					const ticks = parseTicks(eventString);
					console.log('progress: ' + JSON.stringify(ticks));
					if (ticks !== undefined) {
						if (ticks.count == ticks.total) {
							console.log('ready for grabbing');

							let result: IGrabbedContent = session.grab(500, 7);
							console.log('result of grab was: ' + JSON.stringify(result));
							const lines: string[] = result.grabbed_elements.map((element) => {
								return element.content;
							});
							expect(lines).toEqual([
								'some line data: 500',
								'some line data: 501',
								'some line data: 502',
								'some line data: 503',
								'some line data: 504',
								'some line data: 505',
								'some line data: 506'
							]);

							console.log('calling destroy');
							session.destroy();
							setTimeout(done);
						}
					}
					break;
				case EventType.Done:
					console.log('We are done');
					tmpobj.removeCallback();
					break;
				default:
					break;
			}
		});

		session.assignFile(tmpFilePath, 'sourceA');
		console.log('JS: exiting synchronous code execution');
	});

});

/*
describe('Search', function() {
	it('basic file search should work', function(done) {
		const tmp = require('tmp');
		const fs = require('fs');

		const tmpdir = tmp.dirSync({ unsafeCleanup: true });
		const tmpfile_path = path.join(tmpdir.name, 'file_to_search.txt');
		const tmpfile = fs.openSync(tmpfile_path, 'w');

		console.log(`Create example file to search in ${tmpfile_path}`);
		for (let i = 0; i < 100; i++) {
			fs.appendFileSync(tmpfile, `Search me ${i}times!!\n`);
		}
		console.log(`Created file with size: ${fs.statSync(tmpfile_path).size} bytes`);

		let current_progress: number = 0.0;
		const session_id = 'Search-Session-2';
		const operation_id = 'SEARCH';
		const session = new addon.Session(session_id, tmpfile_path);

		session.add_operation(operation_id, '', function(event: string, data: any, data2: any) {
			if (event == addon.DONE) {
				const result_value = data as string;
				console.log(`JS: Done, result_value: ${result_value}`);
				const content = fs.readFileSync(result_value, 'utf8')
				expect(content).toEqual([
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
				tmpdir.removeCallback();
				setTimeout(done);
			} else if (event == addon.STOPPED) {
			} else if (event == addon.PROGRESS) {
				current_progress = (((data as number) / data2) as number) * 100.0;
				console.log('JS: got progress: ' + current_progress.toFixed(1));
			} else {
				console.log(`JS: invalid command: ${event}`);
			}
		});
		session.async_function(operation_id, '5times');
		console.log('JS: exiting synchronous code execution');
	});
});
*/
