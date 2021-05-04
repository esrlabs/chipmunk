// tslint:disable

// We need to provide path to TypeScript types definitions
/// <reference path="../node_modules/@types/jasmine/index.d.ts" />
/// <reference path="../node_modules/@types/node/index.d.ts" />

import * as tmp from 'tmp';
import * as fs from 'fs';

import { RustSessionDebug } from '../src/native/native.session';
import { EventProvider } from '../src/api/session.provider';
import { IGrabbedContent, IGrabbedElement } from '../src/interfaces/index';
import { IFilter } from '../src/interfaces/index';
import { IGeneralError } from '../src/interfaces/errors';

import uuid from '../src/util/uuid';

// Get rid of default Jasmine timeout
jasmine.DEFAULT_TIMEOUT_INTERVAL = 900000;

describe('Session', function() {

	it('Assign and grab content', function(done) {
		function createSampleFile(lines: number) {
			const tmpobj = tmp.fileSync();
			console.log(`Create example grabber file`);
			for (let i = 0; i < lines; i++) {
				fs.appendFileSync(tmpobj.name, `some line data: ${i}\n`);
			}
			var stats = fs.statSync(tmpobj.name);
			console.log(`file-size: ${stats.size}`);
			return tmpobj;
		}

		const suuid: string = uuid();
		const provider = new EventProvider(suuid);
		// Set provider into debug mode
		provider.debug().setStoring(true);
		provider.debug().setTracking(true);

		const session = new RustSessionDebug(suuid, provider.getEmitter());
		expect(session.id()).toEqual(suuid);

		const tmpobj = createSampleFile(5000);
		const operation: string | IGeneralError = session.assign(tmpobj.name, {});
		if (typeof operation !== 'string') {
			fail(`Expecting get ID of operation, but has been gotten: ${operation}`);
			session.destroy();
			return done();
		}
		setTimeout(() => {
			// While we do not have operation id
			let result: IGrabbedElement[] | IGeneralError = session.grabStreamChunk(500, 7);
			if (!(result instanceof Array)) {
				fail(`Fail to grab data due error: ${result.message}`);
				session.destroy();
				return done();
			}
			console.log('result of grab was: ' + JSON.stringify(result));
			expect(result.map(i => i.content)).toEqual([
				'some line data: 500',
				'some line data: 501',
				'some line data: 502',
				'some line data: 503',
				'some line data: 504',
				'some line data: 505',
				'some line data: 506'
			]);
			// Check state of provider
			expect(provider.debug().stat.unsupported().length).toEqual(0);
			expect(provider.debug().stat.error().length).toEqual(0);
			session.destroy();
			done();
		}, 1000);
	});
});
