// function createSampleFile(lines: number) {
// 	const tmp = require('tmp');
// 	const fs = require('fs');

// 	const tmpobj = tmp.fileSync();

// 	console.log(`Create example grabber file`);
// 	for (let i = 0; i < lines; i++) {
// 		fs.appendFileSync(tmpobj.name, `some line data: ${i}\n`);
// 	}
// 	var stats = fs.statSync(tmpobj.name);
// 	console.log(`file-size: ${stats.size}`);
// 	return tmpobj;
// }
// function sleep(ms: number) {
// 	return new Promise((resolve) => setTimeout(resolve, ms));
// }

// enum EventType {
// 	Progress,
// 	Done,
// 	Other
// }

// function parseEventType(eventString: string): EventType {
// 	console.log('JS: received event, string: ' + eventString);
// 	const event = JSON.parse(eventString);
// 	console.log('JS: received event, keys: ' + Object.keys(event));
// 	if (event.hasOwnProperty('Progress')) {
// 		return EventType.Progress;
// 	}
// 	if (event.hasOwnProperty('Done')) {
// 		return EventType.Done;
// 	}
// 	return EventType.Other;
// }

// enum ProgressType {
// 	Ticks,
// 	Stopped,
// 	Notification
// }
// enum Severity {
// 	Warning,
// 	Error
// }
// interface Notification {
// 	severity: Severity;
// 	content: string;
// 	line?: number;
// }
// interface Ticks {
// 	count: number;
// 	total: number;
// }

// interface Stopped {}
// interface Progress {
// 	content: Ticks | Notification | Stopped;
// }

// function parseTicks(eventString: string): Ticks | undefined {
// 	const event = JSON.parse(eventString);
// 	if (event.Progress.type == 'Ticks') {
// 		const ticks = { count: event.Progress.count, total: event.Progress.total } as Ticks;
// 		return ticks;
// 	}
// 	return undefined;
// }


// /*
// describe('Search', function() {
// 	it('basic file search should work', function(done) {
// 		const tmp = require('tmp');
// 		const fs = require('fs');

// 		const tmpdir = tmp.dirSync({ unsafeCleanup: true });
// 		const tmpfile_path = path.join(tmpdir.name, 'file_to_search.txt');
// 		const tmpfile = fs.openSync(tmpfile_path, 'w');

// 		console.log(`Create example file to search in ${tmpfile_path}`);
// 		for (let i = 0; i < 100; i++) {
// 			fs.appendFileSync(tmpfile, `Search me ${i}times!!\n`);
// 		}
// 		console.log(`Created file with size: ${fs.statSync(tmpfile_path).size} bytes`);

// 		let current_progress: number = 0.0;
// 		const session_id = 'Search-Session-2';
// 		const operation_id = 'SEARCH';
// 		const session = new addon.Session(session_id, tmpfile_path);

// 		session.add_operation(operation_id, '', function(event: string, data: any, data2: any) {
// 			if (event == addon.DONE) {
// 				const result_value = data as string;
// 				console.log(`JS: Done, result_value: ${result_value}`);
// 				const content = fs.readFileSync(result_value, 'utf8')
// 				expect(content).toEqual([
// 					'some line data: 500',
// 					'some line data: 501',
// 					'some line data: 502',
// 					'some line data: 503',
// 					'some line data: 504',
// 					'some line data: 505',
// 					'some line data: 506'
// 				]);

// 				// release the underlying EventHandler
// 				session.shutdown_operation(operation_id);
// 				tmpdir.removeCallback();
// 				setTimeout(done);
// 			} else if (event == addon.STOPPED) {
// 			} else if (event == addon.PROGRESS) {
// 				current_progress = (((data as number) / data2) as number) * 100.0;
// 				console.log('JS: got progress: ' + current_progress.toFixed(1));
// 			} else {
// 				console.log(`JS: invalid command: ${event}`);
// 			}
// 		});
// 		session.async_function(operation_id, '5times');
// 		console.log('JS: exiting synchronous code execution');
// 	});
// });
// */
