// tslint:disable

// We need to provide path to TypeScript types definitions
/// <reference path="../node_modules/@types/jasmine/index.d.ts" />
/// <reference path="../node_modules/@types/node/index.d.ts" />

import * as tmp from 'tmp';
import * as fs from 'fs';

import { Session } from '../src/api/session';
import { IGrabbedElement } from '../src/interfaces/index';
import { IGeneralError } from '../src/interfaces/errors';

// Get rid of default Jasmine timeout
jasmine.DEFAULT_TIMEOUT_INTERVAL = 900000;

describe('Session', function() {

	it('Assign & single search', function(done) {
		function createSampleFile(lines: number) {
			const tmpobj = tmp.fileSync();
			console.log(`Create example grabber file`);
			for (let i = 0; i < lines; i++) {
				fs.appendFileSync(tmpobj.name, `[${i}]:: ${(i % 100 === 0 || i <= 5) ? `some match line data\n` : `some line data\n`}`);
			}
			var stats = fs.statSync(tmpobj.name);
			console.log(`file-size: ${stats.size}`);
			return tmpobj;
		}

		const session = new Session();
		// Set provider into debug mode
		session.debug(true);
		const stream = session.getStream();
		const search = session.getSearch();
		if (stream instanceof Error) {
			fail(stream);
			return done();
		}
		if (search instanceof Error) {
			fail(search);
			return done();
		}

		const tmpobj = createSampleFile(5000);
		stream.assign(tmpobj.name, {}).then(() => {
			// metadata was created
			search.search([
				{
					filter: 'match',
					flags: { reg: true, word: false, cases: false },
				},
			]).then((_) => {
				// search results available on rust side
				expect(search.len()).toEqual(55);
				search.getMap(54).then((map) => {
					console.log(map);
					let result: IGrabbedElement[] | IGeneralError = search.grab(0, 10);
					if (!(result instanceof Array)) {
						fail(`Fail to grab data due error: ${result.message}`);
						session.destroy();
						return done();
					}
					console.log(result);
					expect(result.map(i => i.content)).toEqual([
						'[0]:: some match line data',
						'[1]:: some match line data',
						'[2]:: some match line data',
						'[3]:: some match line data',
						'[4]:: some match line data',
						'[5]:: some match line data',
						'[100]:: some match line data',
						'[200]:: some match line data',
						'[300]:: some match line data',
						'[400]:: some match line data',
						'[500]:: some match line data',
					]);
					expect(result.map(i => i.row)).toEqual([
						0,
						1,
						2,
						3,
						4,
						5,
						6,
						7,
						8,
						9,
						10,
					]);
					expect(result.map(i => i.position)).toEqual([
						0,	// 0
						1,	// 1
						2,	// 2
						3,	// 3
						4,	// 4
						5,	// 5
						100,// 6
						200,// 7
						300,// 8
						400,// 9
						500,// 10
					]);
					console.log('result of grab was: ' + result.map((x) => x.content).join('\n'));
					[[10, 5, 5], [110, 6, 100], [390, 9, 400], [600, 11, 600]].forEach((data) => {
						const nearest = search.getNearest(data[0]);
						expect(typeof nearest).toEqual('object');
						expect((nearest as any).index).toEqual(data[1]);
						expect((nearest as any).position).toEqual(data[2]);
					});
					const stat = session.getDebugStat();
					if (stat.unsupported.length !== 0) {
						fail(new Error(`Unsupported events:\n\t- ${stat.unsupported.join('\n\t- ')}`));
						return done();
					}
					if (stat.errors.length !== 0) {
						fail(new Error(`Errors:\n\t- ${stat.errors.join('\n\t- ')}`));
						return done();
					}
					done();
				}).catch((err: Error) => {
					fail(err);
					done();
				});
			}).catch((err: Error) => {
				fail(err);
				done();
			}).finally(() => {
				session.destroy();
			});
		}).catch((err: Error) => {
			session.destroy();
			fail(err);
			done();
		});
	});

	it('Assign & multiple search', function(done) {
		function createSampleFile(lines: number) {
			const tmpobj = tmp.fileSync();
			console.log(`Create example grabber file`);
			for (let i = 0; i < lines; i++) {
				fs.appendFileSync(tmpobj.name, `[${i}]:: ${(i % 100 === 0 || i <= 5) ?
					`some match A line data\n` :
					i % 50 === 0 ? `some match B line data\n` :
					i === 9 ? `some 666 line data\n` : `some line data\n`}`);
			}
			var stats = fs.statSync(tmpobj.name);
			console.log(`file-size: ${stats.size}`);
			return tmpobj;
		}

		const session = new Session();
		// Set provider into debug mode
		session.debug(true);
		const stream = session.getStream();
		const search = session.getSearch();
		if (stream instanceof Error) {
			fail(stream);
			return done();
		}
		if (search instanceof Error) {
			fail(search);
			return done();
		}

		const tmpobj = createSampleFile(5000);
		stream.assign(tmpobj.name, {}).then(() => {
			search.search([
				{
					filter: 'match A',
					flags: { reg: true, word: false, cases: false },
				},
				{
					filter: 'match B',
					flags: { reg: true, word: false, cases: false },
				},
				{
					filter: '666',
					flags: { reg: true, word: false, cases: false },
				},
			]).then(() => {
				expect(search.len()).toEqual(111);
				let result: IGrabbedElement[] | IGeneralError = search.grab(0, 10);
				if (!(result instanceof Array)) {
					fail(`Fail to grab data due error: ${result.message}`);
					session.destroy();
					return done();
				}
				console.log(result);
				expect(result.map(i => i.content)).toEqual([
					'[0]:: some match A line data',
					'[1]:: some match A line data',
					'[2]:: some match A line data',
					'[3]:: some match A line data',
					'[4]:: some match A line data',
					'[5]:: some match A line data',
					'[9]:: some 666 line data',
					'[50]:: some match B line data',
					'[100]:: some match A line data',
					'[150]:: some match B line data',
					'[200]:: some match A line data',
				]);
				expect(result.map(i => i.row)).toEqual([
					0,
					1,
					2,
					3,
					4,
					5,
					6,
					7,
					8,
					9,
					10,
				]);
				expect(result.map(i => i.position)).toEqual([
					0,	// 0
					1,	// 1
					2,	// 2
					3,	// 3
					4,	// 4
					5,	// 5
					9,	// 6
					50,	// 7
					100,// 8
					150,// 9
					200,// 10
				]);
				console.log('result of grab was: ' + result.map((x) => x.content).join('\n'));
				[[5, 5, 5], [10, 6, 9], [55, 7, 50], [190, 10, 200]].forEach((data) => {
					const nearest = search.getNearest(data[0]);
					expect(typeof nearest).toEqual('object');
					expect((nearest as any).index).toEqual(data[1]);
					expect((nearest as any).position).toEqual(data[2]);
				});
				const stat = session.getDebugStat();
				if (stat.unsupported.length !== 0) {
					fail(new Error(`Unsupported events:\n\t- ${stat.unsupported.join('\n\t- ')}`));
					return done();
				}
				if (stat.errors.length !== 0) {
					fail(new Error(`Errors:\n\t- ${stat.errors.join('\n\t- ')}`));
					return done();
				}
				done();
			}).catch((err: Error) => {
				fail(err);
				done();
			}).finally(() => {
				session.destroy();
			});
		}).catch((err: Error) => {
			session.destroy();
			fail(err);
			done();
		});
	});

	it('Assign & zero search', function(done) {
		function createSampleFile(lines: number) {
			const tmpobj = tmp.fileSync();
			console.log(`Create example grabber file`);
			for (let i = 0; i < lines; i++) {
				fs.appendFileSync(tmpobj.name, `[${i}]:: some line data\n`);
			}
			var stats = fs.statSync(tmpobj.name);
			console.log(`file-size: ${stats.size}`);
			return tmpobj;
		}

		const session = new Session();
		// Set provider into debug mode
		session.debug(true);
		const stream = session.getStream();
		const search = session.getSearch();
		if (stream instanceof Error) {
			fail(stream);
			return done();
		}
		if (search instanceof Error) {
			fail(search);
			return done();
		}

		const tmpobj = createSampleFile(5000);
		stream.assign(tmpobj.name, {}).then(() => {
			search.search([
				{
					filter: 'not relevant search',
					flags: { reg: true, word: false, cases: false },
				},
			]).then(() => {
				expect(search.len()).toEqual(0);
				let result: IGrabbedElement[] | IGeneralError = search.grab(0, 10);
				if (!(result instanceof Array)) {
					fail(`Fail to grab data due error: ${result.message}`);
					session.destroy();
					return done();
				}
				console.log(result);
				console.log('result of grab was: ' + result.map((x) => x.content).join('\n'));
				const stat = session.getDebugStat();
				if (stat.unsupported.length !== 0) {
					fail(new Error(`Unsupported events:\n\t- ${stat.unsupported.join('\n\t- ')}`));
					return done();
				}
				if (stat.errors.length !== 0) {
					fail(new Error(`Errors:\n\t- ${stat.errors.join('\n\t- ')}`));
					return done();
				}
				done();
			}).catch((err: Error) => {
				fail(err);
				done();
			}).finally(() => {
				session.destroy();
			});
		}).catch((err: Error) => {
			session.destroy();
			fail(err);
			done();
		});
	});

});
