import { CancelablePromise } from './util/promise';
import { indexAsync } from './api/processor';
import {
	DltFilterConf,
	DltLogLevel,
	IIndexDltParams,
	dltOverSocket,
	ISocketConfig,
	IMulticastInfo,
	indexPcapDlt
} from './api/dlt';
import indexer, { DLT, Merge, Progress } from './index';
import { ITicks, IChunk, AsyncResult, INeonNotification, IDiscoverItem, IMergerItemOptions } from './util/progress';
import * as log from 'loglevel';
import { IConcatFilesParams, ConcatenatorInput } from './api/merger';
import { StdoutController } from 'custom.stdout';
import { Detect } from '../../../common/interfaces/index';

import * as fs from 'fs';
import { RustGrabberClass, createGrabberAsync } from './api/grabber';
import { discoverTimespanAsync, checkFormat } from './api/timestamps';

const stdout = new StdoutController(process.stdout, { handleStdoutGlobal: true });

export const examplePath: String = '/Users/muellero/tmp/logviewer_usecases';

// testing
function measure({ desc, f }: { desc: String; f: () => void }) {
	const hrstart = process.hrtime();
	try {
		f();
	} catch (error) {
		log.error('error %s: %s', desc, error);
	}
	const hrend = process.hrtime(hrstart);
	const ms = Math.round(hrend[0] * 1000 + hrend[1] / 1000000);
	log.info('Execution time %s : %dms', desc, ms);
}

export function testCallMergeFiles(mergeConf: string, out: string) {
	log.setDefaultLevel(log.levels.WARN);
	log.debug(`calling testCallMergeFiles with mergeConf: ${mergeConf}, out: ${out}`);
	const bar = stdout.createProgressBar({ caption: 'merging files', width: 60 });
	let onProgress = (ticks: ITicks) => {
		bar.update(Math.round(100 * ticks.ellapsed / ticks.total));
	};
	let onNotification = (notification: INeonNotification) => {
		log.debug('TTT: testCallMergeFiles: received notification:' + JSON.stringify(notification));
	};
	log.debug('before measure');
	measure({
		desc: 'TTT: merge with config: ' + mergeConf + ', output: ' + out,
		f: () => {
			let merged_lines: number = 0;
			let onResult = (res: IChunk) => {
				log.debug('rowsEnd= ' + JSON.stringify(res));
				merged_lines = res.rowsEnd;
			};
			log.debug('inside f measure');
			const contents = fs.readFileSync(mergeConf, 'utf8');
			log.debug(`contents is: ${contents}`);
			const config: Array<IMergerItemOptions> = JSON.parse(contents);
			log.debug(`config is: ${JSON.stringify(config)}`);
			const filePath = require('path').dirname(mergeConf);
			const absolutePathConfig: Array<IMergerItemOptions> = config.map((input: IMergerItemOptions) => {
				log.debug(`input is: ${JSON.stringify(input)}`);
				input.path = require('path').resolve(filePath, input.path);
				return input;
			});
			log.debug(`absolutePathConfig: ${JSON.stringify(absolutePathConfig)}`);
			const promise: CancelablePromise<
				void,
				void,
				Merge.TMergeFilesEvents,
				Merge.TMergeFilesEventObject
			> = indexer
				.mergeFilesAsync(absolutePathConfig, out, {
					append: true
				})
				.then(() => {
					log.debug('TTT: done');
					log.debug(`merged_lines: ${merged_lines}`);
				})
				.catch((error: Error) => {
					log.debug(`Fail to merge due error: ${error.message}`);
				})
				.on('result', (event: IChunk) => {
					onResult(event);
				})
				.on('progress', (event: ITicks) => {
					onProgress(event);
				})
				.on('notification', (event: INeonNotification) => {
					onNotification(event);
				});
		}
	});
}
export function testCallConcatFiles(concatConfig: string, out: string, chunk_size: number) {
	log.setDefaultLevel(log.levels.WARN);
	const bar = stdout.createProgressBar({ caption: 'concatenating files', width: 60 });
	let onProgress = (ticks: ITicks) => {
		bar.update(Math.round(100 * ticks.ellapsed / ticks.total));
	};
	let onResult = (res: IChunk) => {
		log.debug('TTT: concatenated res: ' + JSON.stringify(res));
	};
	let onNotification = (notification: INeonNotification) => {
		log.debug('TTT: testCallConcatFiles: received notification:' + JSON.stringify(notification));
	};
	measure({
		desc: 'TTT: concatenate with config: ' + concatConfig + ', output: ' + out,
		f: () => {
			const concatFilesParams: IConcatFilesParams = {
				configFile: concatConfig,
				out,
				append: false
			};
			const contents = fs.readFileSync(concatConfig, 'utf8');
			const config: Array<ConcatenatorInput> = JSON.parse(contents);
			const filePath = require('path').dirname(concatConfig);
			const absolutePathConfig: Array<ConcatenatorInput> = config.map((input: ConcatenatorInput) => {
				input.path = require('path').resolve(filePath, input.path);
				return input;
			});
			const promise: CancelablePromise<
				void,
				void,
				Merge.TConcatFilesEvents,
				Merge.TConcatFilesEventObject
			> = indexer
				.concatFilesAsync(absolutePathConfig, out, {
					append: true,
					chunk_size
				})
				.then(() => {
					log.debug('TTT: done ');
					// progressBar.update(1.0);
				})
				.catch((error: Error) => {
					log.debug(`Fail to merge due error: ${error.message}`);
				})
				.on('result', (event: IChunk) => {
					onResult(event);
				})
				.on('progress', (event: ITicks) => {
					onProgress(event);
				})
				.on('notification', (event: INeonNotification) => {
					onNotification(event);
				});
		}
	});
}
export function testCheckFormatString(
	input: string,
	flags: Detect.ICheckFormatFlags = { miss_year: false, miss_month: false, miss_day: false }
) {
	log.setDefaultLevel(log.levels.DEBUG);
	log.debug(`calling testCheckFormatString with ${input}`);
	const hrstart = process.hrtime();
	try {
		let onProgress = (ticks: ITicks) => {
			log.trace('progress: ' + Math.round(100 * ticks.ellapsed / ticks.total) + '%');
		};
		let onNotification = (notification: INeonNotification) => {
			log.debug('testDiscoverTimestampAsync: received notification:' + JSON.stringify(notification));
		};
		checkFormat(input, flags)
			.then(() => {
				const hrend = process.hrtime(hrstart);
				const ms = Math.round(hrend[0] * 1000 + hrend[1] / 1000000);
				log.info('Execution time for format check : %dms', ms);
			})
			.catch((error: Error) => {
				log.debug(`Failed with error: ${error.message}`);
			})
			.on('chunk', (event: Progress.IFormatCheckResult) => {
				log.debug('received ' + JSON.stringify(event));
				log.debug('event.FormatInvalid: ' + event.FormatInvalid);
				log.debug('event.FormatRegex: ' + event.FormatRegex);
				// log.debug('event.format.Err ' + JSON.stringify(event.format?.Err));
			})
			.on('progress', (event: Progress.ITicks) => {
				onProgress(event);
			})
			.on('notification', (event: Progress.INeonNotification) => {
				onNotification(event);
			});
	} catch (error) {
		log.error('error %s', error);
	}
}

export function testCallDltStats(file: string) {
	log.setDefaultLevel(log.levels.DEBUG);
	const hrstart = process.hrtime();
	try {
		let onProgress = (ticks: ITicks) => {
			log.trace('progress: ' + JSON.stringify(ticks));
		};
		let onConf = (conf: DLT.StatisticInfo) => {
			log.debug('testCallDltStats.onConf:');
			log.debug('conf.app_ids: ' + JSON.stringify(conf.app_ids));
			log.debug('conf.ecu_ids: ' + JSON.stringify(conf.ecu_ids));
			log.debug('conf.context_ids: ' + JSON.stringify(conf.context_ids));
		};
		measure({
			desc: 'stats for ' + file,
			f: () => {
				indexer
					.dltStatsAsync(file)
					.then(() => {
						const hrend = process.hrtime(hrstart);
						const ms = Math.round(hrend[0] * 1000 + hrend[1] / 1000000);
						log.debug('COMPLETELY DONE');
						log.info('Execution time for getting DLT stats : %dms', ms);
					})
					.catch((error: Error) => {
						log.warn(`Failed with error: ${error.message}`);
					})
					.on('config', (event: DLT.StatisticInfo) => {
						onConf(event);
					})
					.on('notification', (event: INeonNotification) => {
						log.debug(`notification: ${JSON.stringify(event)}`);
					})
					.on('progress', (ticks: Progress.ITicks) => {
						onProgress(ticks);
					});
			}
		});
	} catch (error) {
		log.error('error %s', error);
	}
}

export function testDiscoverTimestampAsync(files: string[]) {
	log.setDefaultLevel(log.levels.DEBUG);
	log.debug(`calling testDiscoverTimestampAsync with ${files}`);
	const hrstart = process.hrtime();
	const bar = stdout.createProgressBar({ caption: 'discover timestamp', width: 60 });
	try {
		let onProgress = (ticks: ITicks) => {
			log.debug('onProgress');
			bar.update(Math.round(100 * ticks.ellapsed / ticks.total));
		};
		let onNotification = (notification: INeonNotification) => {
			log.debug('testDiscoverTimestampAsync: received notification:' + JSON.stringify(notification));
		};
		let items: IDiscoverItem[] = files.map((file: string) => {
			return {
				path: file,
				format_string: 'YYYY-MM-DD hh:mm:ss.s'
			};
		});
		discoverTimespanAsync(items)
			.then(() => {
				const hrend = process.hrtime(hrstart);
				const ms = Math.round(hrend[0] * 1000 + hrend[1] / 1000000);
				bar.update(100);
				log.debug('COMPLETELY DONE');
				log.info('Execution time for indexing : %dms', ms);
			})
			.catch((error: Error) => {
				log.debug(`Failed with error: ${error.message}`);
			})
			.on('chunk', (event: Progress.ITimestampFormatResult) => {
				log.debug('received ' + JSON.stringify(event));
				log.debug('event.format ' + JSON.stringify(event.format));
				// log.debug('event.format.Ok ' + JSON.stringify(event.format?.Ok));
				// log.debug('event.format.Err ' + JSON.stringify(event.format?.Err));
			})
			.on('progress', (event: Progress.ITicks) => {
				onProgress(event);
			})
			.on('notification', (event: Progress.INeonNotification) => {
				onNotification(event);
			});
	} catch (error) {
		log.error('error %s', error);
	}
}

class IndexingHelper {
	bar: any;
	hrstart: [number, number];
	notificationCount: number = 0;
	constructor(name: string) {
		this.bar = stdout.createProgressBar({ caption: name, width: 60 });
		this.hrstart = process.hrtime();
		// this.onProgress = this.onProgress.bind(this);
		// this.onChunk = this.onChunk.bind(this);
		// this.onNotification = this.onNotification.bind(this);
		// this.done = this.done.bind(this);
	}
	public onProgress = (ticks: ITicks) => {
		this.bar.update(Math.round(100 * ticks.ellapsed / ticks.total));
	};
	public onChunk = (_chunk: IChunk) => {};
	public onNotification = (notification: INeonNotification) => {
		this.notificationCount += 1;
	};
	public done = (x: AsyncResult) => {
		this.bar.update(100);
		const hrend = process.hrtime(this.hrstart);
		const ms = Math.round(hrend[0] * 1000 + hrend[1] / 1000000);
		log.debug(`COMPLETELY DONE (last result was: "${AsyncResult[x]}") (notifications: ${this.notificationCount})`);
		log.info('Execution time for indexing : %dms', ms);
	};
}
export function testCancelledAsyncDltIndexing(
	fileToIndex: string,
	outPath: string,
	timeoutMs: number,
	fibexPath?: string
) {
	log.setDefaultLevel(log.levels.WARN);
	const bar = stdout.createProgressBar({ caption: 'dlt indexing', width: 60 });
	let onProgress = (ticks: ITicks) => {
		bar.update(Math.round(100 * ticks.ellapsed / ticks.total));
	};
	let onNotification = (notification: INeonNotification) => {
		log.debug('test: received notification:' + notification);
	};
	let helper = new IndexingHelper('dlt async indexing');
	const filterConfig: DltFilterConf = {
		min_log_level: DltLogLevel.Debug
	};

	const dltParams: IIndexDltParams = {
		dltFile: fileToIndex,
		filterConfig,
		fibex: { fibex_file_paths: [] },
		tag: 'TAG',
		out: outPath,
		chunk_size: 500,
		append: false,
		stdout: false,
		statusUpdates: true
	};
	const task = indexer
		.indexDltAsync(dltParams)
		.then(() => {
			clearTimeout(timerId);
			helper.done(AsyncResult.Completed);
		})
		.catch((error: Error) => {
			log.debug(`Failed with error: ${error.message}`);
		})
		.canceled(() => {
			log.debug(`Operation was canceled`);
		})
		.on('chunk', (event: Progress.IChunk) => {
			helper.onChunk(event);
		})
		.on('progress', (event: Progress.ITicks) => {
			helper.onProgress(event);
		})
		.on('notification', (notification: Progress.INeonNotification) => {
			helper.onNotification(notification);
		});
	const timerId = setTimeout(function() {
		log.debug('cancelling operation after timeout');
		task.abort();
	}, 500);
}

export function testDltIndexingAsync(fileToIndex: string, outPath: string, timeoutMs: number, fibexPath?: string) {
	log.setDefaultLevel(log.levels.DEBUG);
	log.debug(`testDltIndexingAsync for ${fileToIndex} (out: "${outPath}")`);
	let helper = new IndexingHelper('dlt async indexing');
	try {
		const filterConfig: DltFilterConf = {
			min_log_level: DltLogLevel.Warn,
			app_ids: [
				'Cdng',
				'Coor',
				'LOGC',
				'UTC',
				'Hlth',
				'FuSa',
				'AM',
				'EM',
				'DEM',
				'Mdtr',
				'-NI-',
				'Omc',
				'Bs',
				'MON',
				'psn',
				'SYS',
				'DltL',
				'Heat',
				'DR',
				'Fasi',
				'DET',
				'psl',
				'DLTD',
				'CryD',
				'PTS',
				'VSom',
				'PwrM',
				'PTC',
				'MTSC',
				'udsd',
				'cras',
				'Vin',
				'Stm',
				'StdD',
				'Diag',
				'FRay',
				'Bsd3',
				'Para',
				'Bsd2',
				'PSEL',
				'Darh',
				'Bsd1',
				'TEMP',
				'Dlog',
				'FOSE',
				'NONE',
				'Plan',
				'MSM',
				'Perc',
				'SysT',
				'SINA',
				'DA1'
			]
		};
		const fibex_paths = fibexPath === undefined ? [] : [ fibexPath ];
		const dltParams: IIndexDltParams = {
			dltFile: fileToIndex,
			filterConfig,
			fibex: { fibex_file_paths: fibex_paths },
			tag: 'TAG',
			out: outPath,
			chunk_size: 500,
			append: false,
			stdout: false,
			statusUpdates: true
		};
		log.debug('calling indexDltAsync with fibex: ' + fibexPath);
		const promise = indexer.indexDltAsync(dltParams);
		promise
			.then(() => {
				clearTimeout(timerId);
				helper.done(AsyncResult.Completed);
			})
			.catch((error: Error) => {
				log.debug(`Failed with error: ${error.message}`);
			})
			.canceled(() => {
				log.debug(`Operation was canceled`);
			})
			.on('chunk', (event: Progress.IChunk) => {
				helper.onChunk(event);
			})
			.on('progress', (event: Progress.ITicks) => {
				helper.onProgress(event);
			})
			.on('notification', (notification: Progress.INeonNotification) => {
				helper.onNotification(notification);
			});
		const timerId = setTimeout(function() {
			log.debug('cancelling operation after timeout');
			promise.abort();
		}, timeoutMs);
	} catch (error) {
		log.debug('error %s', error);
	}
	log.debug('done with dlt test');
}
export function testIndexingPcap(fileToIndex: string, outPath: string) {
	log.setDefaultLevel(log.levels.WARN);
	const hrstart = process.hrtime();
	const bar = stdout.createProgressBar({ caption: 'index file', width: 60 });
	try {
		let chunks: number = 0;
		let onProgress = (ticks: ITicks) => {
			bar.update(Math.round(100 * ticks.ellapsed / ticks.total));
		};
		let onChunk = (chunk: IChunk) => {
			chunks += 1;
			if (chunks % 100 === 0) {
				process.stdout.write('.');
			}
		};
		let onNotification = (notification: INeonNotification) => {
			log.debug('testIndexingPcap: received notification:' + JSON.stringify(notification));
		};
		const filterConfig: DltFilterConf = {
			min_log_level: DltLogLevel.Debug
		};
		const dltParams: IIndexDltParams = {
			dltFile: fileToIndex,
			filterConfig,
			fibex: { fibex_file_paths: [] },
			tag: 'TAG',
			out: outPath,
			chunk_size: 500,
			append: false,
			stdout: false,
			statusUpdates: true
		};
		indexPcapDlt(dltParams)
			.then(() => {
				bar.update(100);
				const hrend = process.hrtime(hrstart);
				const ms = Math.round(hrend[0] * 1000 + hrend[1] / 1000000);
				log.debug('COMPLETELY DONE');
				log.info('Execution time for indexing : %dms', ms);
			})
			.catch((error: Error) => {
				log.debug(`Failed with error: ${error.message}`);
			})
			.on('chunk', (event: Progress.IChunk) => {
				onChunk(event);
			})
			.on('progress', (event: Progress.ITicks) => {
				onProgress(event);
			})
			.on('notification', (notification: Progress.INeonNotification) => {
				onNotification(notification);
			});
	} catch (error) {
		log.error('error %s', error);
	}
}
export function testIndexingAsync(inFile: string, outPath: string, chunkSize: number) {
	log.setDefaultLevel(log.levels.DEBUG);
	log.debug(`testIndexingAsync for ${inFile} (chunkSize: ${chunkSize}, type: ${typeof chunkSize})`);
	const hrstart = process.hrtime();
	const bar = stdout.createProgressBar({ caption: 'index file', width: 60 });
	try {
		let chunks: number = 0;
		let onProgress = (ticks: ITicks) => {
			log.trace('progress: ' + Math.round(100 * ticks.ellapsed / ticks.total) + '%');
			bar.update(Math.round(100 * ticks.ellapsed / ticks.total));
		};
		let onChunk = (chunk: IChunk) => {
			// log.debug(`onChunk: ${JSON.stringify(chunk)}`)
			chunks += 1;
			if (chunks % 100 === 0) {
				// process.stdout.write('.');
			}
		};
		let onNotification = (notification: INeonNotification) => {
			log.debug('testIndexingAsync: received notification:' + JSON.stringify(notification));
		};
		indexAsync(inFile, outPath, 'TAG', { chunkSize })
			.then(() => {
				bar.update(100);
				const hrend = process.hrtime(hrstart);
				const ms = Math.round(hrend[0] * 1000 + hrend[1] / 1000000);
				log.debug('COMPLETELY DONE');
				log.info('Execution time for indexing : %dms', ms);
				const hrstart2 = process.hrtime();
				// 2nd time
				indexAsync(inFile, outPath, 'TAG', { chunkSize })
					.then(() => {
						bar.update(100);
						const hrend2 = process.hrtime(hrstart2);
						const ms = Math.round(hrend2[0] * 1000 + hrend2[1] / 1000000);
						log.debug('COMPLETELY DONE 2nd time');
						log.info('Execution time for indexing : %dms', ms);
					})
					.catch((error: Error) => {
						log.debug(`Failed with error: ${error.message}`);
					})
					.on('chunk', (event: Progress.IChunk) => {
						onChunk(event);
					})
					.on('progress', (event: Progress.ITicks) => {
						onProgress(event);
					})
					.on('notification', (notification: Progress.INeonNotification) => {
						onNotification(notification);
					});
			})
			.catch((error: Error) => {
				log.debug(`Failed with error: ${error.message}`);
			})
			.on('chunk', (event: Progress.IChunk) => {
				onChunk(event);
			})
			.on('progress', (event: Progress.ITicks) => {
				onProgress(event);
			})
			.on('notification', (notification: Progress.INeonNotification) => {
				onNotification(notification);
			});
	} catch (error) {
		log.error('error %s', error);
	}
}
export function testSocketDlt(outPath: string) {
	log.setDefaultLevel(log.levels.WARN);
	const hrstart = process.hrtime();
	const bar = stdout.createProgressBar({ caption: 'index file', width: 60 });
	try {
		let chunks: number = 0;
		let onProgress = (ticks: ITicks) => {
			bar.update(Math.round(100 * ticks.ellapsed / ticks.total));
		};
		let onChunk = (chunk: IChunk) => {
			chunks += 1;
			if (chunks % 100 === 0) {
				process.stdout.write('.');
			}
		};
		let onNotification = (notification: INeonNotification) => {
			log.debug('testSocketDlt: received notification:' + JSON.stringify(notification));
		};
		const filterConfig: DltFilterConf = {
			min_log_level: DltLogLevel.Debug
		};

		const multicastInfo: IMulticastInfo = {
			multiaddr: '234.2.2.2',
			interface: undefined
		};
		const sockConf: ISocketConfig = {
			multicast_addr: multicastInfo,
			bind_addr: '0.0.0.0',
			port: '8888'
		};
		const session_id = `dlt_${new Date().toISOString()}`;
		const promise = dltOverSocket(
			session_id,
			{
				filterConfig,
				fibex: { fibex_file_paths: [] },
				tag: 'TAG',
				out: outPath,
				stdout: false,
				statusUpdates: false
			},
			sockConf
		)
			.then(() => {
				bar.update(100);
				const hrend = process.hrtime(hrstart);
				const ms = Math.round(hrend[0] * 1000 + hrend[1] / 1000000);
				clearTimeout(timerId);
				log.debug('COMPLETELY DONE');
				log.info('socket dlt ended after: %dms', ms);
			})
			.catch((error: Error) => {
				log.debug(`Failed with error: ${error.message}`);
			})
			.on('chunk', (event: Progress.IChunk) => {
				onChunk(event);
			})
			.on('progress', (event: Progress.ITicks) => {
				onProgress(event);
			})
			.on('notification', (notification: Progress.INeonNotification) => {
				onNotification(notification);
			});
		const timerId = setTimeout(function() {
			log.debug('cancelling operation after timeout');
			promise.abort();
		}, 1000);
	} catch (error) {
		log.error('error %s', error);
	}
}

export function testCancelledAsyncIndexing(fileToIndex: string, outPath: string) {
	log.setDefaultLevel(log.levels.WARN);
	const hrstart = process.hrtime();
	const bar = stdout.createProgressBar({ caption: 'concatenating files', width: 60 });
	let onProgress = (ticks: ITicks) => {
		bar.update(Math.round(100 * ticks.ellapsed / ticks.total));
	};
	let onNotification = (notification: INeonNotification) => {
		log.debug('test: received notification:' + notification);
	};
	let onChunk = (chunk: IChunk) => {};
	const promise = indexAsync(fileToIndex, outPath, 'TAG', { chunkSize: 500 })
		.then(() => {
			const hrend = process.hrtime(hrstart);
			const ms = Math.round(hrend[0] * 1000 + hrend[1] / 1000000);
			clearTimeout(timerId);
			log.debug('first event emitter task finished');
			log.info('Execution time for indexing : %dms', ms);
		})
		.catch((error: Error) => {
			log.debug(`Failed with error: ${error.message}`);
		})
		.canceled(() => {
			log.debug(`Operation was canceled`);
		})
		.on('chunk', (event: Progress.IChunk) => {
			onChunk(event);
		})
		.on('progress', (event: Progress.ITicks) => {
			onProgress(event);
		})
		.on('notification', (notification: Progress.INeonNotification) => {
			onNotification(notification);
		});
	const timerId = setTimeout(function() {
		log.debug('cancelling operation after timeout');
		promise.abort();
	}, 500);
}

export function testGrabLinesInFile(path: string) {
	log.setDefaultLevel(log.levels.DEBUG);

	// if (process.env.NODE_ENV !== 'test') {
	// 	addon.fibonacci(500000, (err: any, result: any) => {
	// 		console.log('async result:');
	// 		console.log(result);
	// 	});

	// 	console.log('computing fibonacci(500000) in background thread...');
	// 	console.log('main thread is still responsive!');
	// }
	// return;

	try {
		const hrstart_create = process.hrtime();

		createGrabberAsync(path).then((grabber) => {
			const hrend_create = process.hrtime(hrstart_create);
			const ms = Math.round(hrend_create[0] * 1000 + hrend_create[1] / 1000000);
			log.info('time to create grabber: %dms', ms);
			log.info('total lines in file: %d', grabber.total_entries());

			const hrstart_index = process.hrtime();
			grabber.create_metadata();
			const hrend_index = process.hrtime(hrstart_index);
			const ms_index = Math.round(hrend_index[0] * 1000 + hrend_index[1] / 1000000);
			log.info('time to create metadata: %dms', ms_index);
			log.info('total lines in file: %d', grabber.total_entries());

			let entry_cnt = grabber.total_entries();
			if (entry_cnt !== undefined) {
				const hrstart = process.hrtime();
				const start_line = entry_cnt - 1000;
				const lines_to_grab = 200;
				const lines = grabber.grab(start_line, lines_to_grab);
				const hrend = process.hrtime(hrstart);
				const us = Math.round(hrend[0] * 1000 + hrend[1] / 1000);
				log.info('Execution time for grabbing %d lines from index %d: %dus', lines_to_grab, start_line, us);
				let i = 0;
				for (const line of lines) {
					log.debug('line %d =-----> %s', start_line + i, line);
					i += 1;
					if (i > 5) {
						break;
					}
				}
			}
		}).catch((e) => {
			log.warn(`Error during grabbing: ${e}`);
		});
		log.info("waiting for grabber...");
	} catch (error) {
		log.warn('Error from RustGrabber: %s', error.message);
	}
}
