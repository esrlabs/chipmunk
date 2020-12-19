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

// Get rid of default Jasmine timeout
jasmine.DEFAULT_TIMEOUT_INTERVAL = 900000;

describe('Session', function() {
	it('basic session support', function(done) {
		const session_id = 'Rust-Session-1';
		const session = new addon.RustSession(session_id, function(event: string) {
			console.log('JS: received event: ' + event);
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
		session.setFilters(JSON.stringify([filterA]));
		console.log('filters:' + session.getFilters());
		session.setFilters(JSON.stringify([filterB]));
		console.log('filters:' + session.getFilters());
		session.clearFilters();
		console.log('filters:' + session.getFilters());
		session.shutdown();
		console.log('test done');
	});
});
