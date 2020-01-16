import { CancelablePromise } from './promise';
import { indexAsync, IFilePath, discoverTimespanAsync } from './processor';
import { DltFilterConf, DltLogLevel, IIndexDltParams, dltOverSocket, ISocketConfig, IMulticastInfo } from './dlt';
import indexer, { DLT, Units, Merge, Progress } from './index';
import {
	ITicks,
	IChunk,
	AsyncResult,
	INeonNotification,
	ITimestampFormatResult,
	IDiscoverItem,
	IMergerItemOptions
} from './progress';
import * as log from 'loglevel';
import { IConcatFilesParams, ConcatenatorInput } from './merger';
import { StdoutController } from 'custom.stdout';
import * as fs from 'fs';
import { on } from 'cluster';

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
	log.debug(`calling testCallMergeFiles with mergeConf: ${mergeConf}, out: ${out}`);
	const bar = stdout.createProgressBar({ caption: 'merging files', width: 60 });
	let onProgress = (ticks: ITicks) => {
		bar.update(Math.round(100 * ticks.ellapsed / ticks.total));
	};
	let onNotification = (notification: INeonNotification) => {
		log.debug('TTT: testDiscoverTimespanAsync: received notification:' + JSON.stringify(notification));
	};
	log.trace('before measure');
	measure({
		desc: 'TTT: merge with config: ' + mergeConf + ', output: ' + out,
		f: () => {
			let merged_lines: number = 0;
			let onResult = (res: IChunk) => {
				log.trace('rowsEnd= ' + JSON.stringify(res));
				merged_lines = res.rowsEnd;
			};
			log.trace('inside f measure');
			const contents = fs.readFileSync(mergeConf, 'utf8');
			log.trace(`contents is: ${contents}`);
			const config: Array<IMergerItemOptions> = JSON.parse(contents);
			log.trace(`config is: ${JSON.stringify(config)}`);
			const filePath = require('path').dirname(mergeConf);
			const absolutePathConfig: Array<IMergerItemOptions> = config.map((input: IMergerItemOptions) => {
				log.trace(`input is: ${JSON.stringify(input)}`);
				input.name = require('path').resolve(filePath, input.name);
				return input;
			});
			log.trace(`absolutePathConfig: ${JSON.stringify(absolutePathConfig)}`);
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
					log.trace('TTT: done');
					log.trace(`merged_lines: ${merged_lines}`);
				})
				.catch((error: Error) => {
					log.trace(`Fail to merge due error: ${error.message}`);
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
export function testCallConcatFiles(concatConfig: string, out: string) {
	const bar = stdout.createProgressBar({ caption: 'concatenating files', width: 60 });
	let onProgress = (ticks: ITicks) => {
		bar.update(Math.round(100 * ticks.ellapsed / ticks.total));
	};
	let onResult = (res: IChunk) => {
		log.trace('TTT: concatenated res: ' + JSON.stringify(res));
	};
	let onNotification = (notification: INeonNotification) => {
		log.trace('TTT: testDiscoverTimespanAsync: received notification:' + JSON.stringify(notification));
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
					chunk_size: 100
				})
				.then(() => {
					log.trace('TTT: done ');
					// progressBar.update(1.0);
				})
				.catch((error: Error) => {
					log.trace(`Fail to merge due error: ${error.message}`);
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
function testDetectTimestampInString() {
	measure({
		desc: 'detect timestamp in string',
		f: () => {
			let timestamp;
			try {
				timestamp = indexer.detectTimestampInString(
					'109.169.248.247 - - [13/Dec/2015:18:25:11 +0100] GET /administrator'
				);
			} catch (error) {
				log.error('error getting timestamp');
			}
			log.trace(timestamp);
		}
	});
}
function testDetectTimestampInFile() {
	measure({
		desc: 'detect timestamp in file',
		f: () => {
			const x = indexer.detectTimestampFormatInFile(examplePath + '/indexing/access_small.log');
			log.trace(x);
		}
	});
}
function testDetectTimestampFormatsInFiles() {
	measure({
		desc: 'detect timestamp in formats in files',
		f: () => {
			const conf: Array<IFilePath> = [
				{ path: examplePath + '/indexing/access_tiny.log' },
				{ path: examplePath + '/indexing/access_small.log' },
				{ path: examplePath + '/indexing/access_mid.log' }
			];
		}
	});
}
export function testCallDltStats(file: string) {
	log.setDefaultLevel(log.levels.TRACE);
	const hrstart = process.hrtime();
	try {
		let onProgress = (ticks: ITicks) => {
			log.debug('progress: ' + JSON.stringify(ticks));
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

export function testDiscoverTimespanAsync(files: string[]) {
	log.trace(`calling testDiscoverTimespanAsync with ${files}`);
	const hrstart = process.hrtime();
	const bar = stdout.createProgressBar({ caption: 'discover timestamp', width: 60 });
	try {
		let onProgress = (ticks: ITicks) => {
			bar.update(Math.round(100 * ticks.ellapsed / ticks.total));
		};
		let onChunk = (chunk: ITimestampFormatResult) => {
			log.trace('received ' + JSON.stringify(chunk));
		};
		let onNotification = (notification: INeonNotification) => {
			log.trace('testDiscoverTimespanAsync: received notification:' + JSON.stringify(notification));
		};
		let items: IDiscoverItem[] = files.map((file: string) => {
			return {
				path: file
			};
		});
		discoverTimespanAsync(items)
			.then(() => {
				const hrend = process.hrtime(hrstart);
				const ms = Math.round(hrend[0] * 1000 + hrend[1] / 1000000);
				bar.update(100);
				log.trace('COMPLETELY DONE');
				log.info('Execution time for indexing : %dms', ms);
			})
			.catch((error: Error) => {
				log.trace(`Failed with error: ${error.message}`);
			})
			.on('chunk', (event: Progress.ITimestampFormatResult) => {
				onChunk(event);
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
		log.trace(`COMPLETELY DONE (last result was: "${AsyncResult[x]}") (notifications: ${this.notificationCount})`);
		log.info('Execution time for indexing : %dms', ms);
	};
}
export function testCancelledAsyncDltIndexing(
	fileToIndex: string,
	outPath: string,
	timeoutMs: number,
	fibexPath?: string
) {
	const bar = stdout.createProgressBar({ caption: 'dlt indexing', width: 60 });
	let onProgress = (ticks: ITicks) => {
		bar.update(Math.round(100 * ticks.ellapsed / ticks.total));
	};
	let onNotification = (notification: INeonNotification) => {
		log.trace('test: received notification:' + notification);
	};
	let helper = new IndexingHelper('dlt async indexing');
	const filterConfig: DltFilterConf = {
		min_log_level: DltLogLevel.Debug
	};

	const dltParams: IIndexDltParams = {
		dltFile: fileToIndex,
		filterConfig,
		fibex: fibexPath,
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
			log.trace(`Failed with error: ${error.message}`);
		})
		.canceled(() => {
			log.trace(`Operation was canceled`);
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
		log.trace('cancelling operation after timeout');
		task.abort();
	}, 500);
}

export function testDltIndexingAsync(fileToIndex: string, outPath: string, timeoutMs: number, fibexPath?: string) {
	log.setDefaultLevel(log.levels.DEBUG);
	log.debug(`testDltIndexingAsync for ${fileToIndex} (out: "${outPath}")`);
	let helper = new IndexingHelper('dlt async indexing');
	try {
		const filterConfig: DltFilterConf = {
			min_log_level: DltLogLevel.Debug
		};
		const dltParams: IIndexDltParams = {
			dltFile: fileToIndex,
			filterConfig,
			fibex: fibexPath,
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
export function testIndexingAsync(inFile: string, outPath: string) {
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
			log.trace('testIndexingAsync: received notification:' + JSON.stringify(notification));
		};
		indexAsync(inFile, outPath, 'TAG', { chunkSize: 500 })
			.then(() => {
				bar.update(100);
				const hrend = process.hrtime(hrstart);
				const ms = Math.round(hrend[0] * 1000 + hrend[1] / 1000000);
				log.trace('COMPLETELY DONE');
				log.info('Execution time for indexing : %dms', ms);
			})
			.catch((error: Error) => {
				log.trace(`Failed with error: ${error.message}`);
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
			log.trace('testSocketDlt: received notification:' + JSON.stringify(notification));
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
		const promise = dltOverSocket(
			"myEcuId",
			{
				filterConfig,
				fibex: undefined,
				tag: 'TAG',
				out: outPath,
				append: false,
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
				log.trace('COMPLETELY DONE');
				log.info('socket dlt ended after: %dms', ms);
			})
			.catch((error: Error) => {
				log.trace(`Failed with error: ${error.message}`);
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
			log.trace('cancelling operation after timeout');
			promise.abort();
		}, 1000);
	} catch (error) {
		log.error('error %s', error);
	}
}

export function testCancelledAsyncIndexing(fileToIndex: string, outPath: string) {
	const hrstart = process.hrtime();
	const bar = stdout.createProgressBar({ caption: 'concatenating files', width: 60 });
	let onProgress = (ticks: ITicks) => {
		bar.update(Math.round(100 * ticks.ellapsed / ticks.total));
	};
	let onNotification = (notification: INeonNotification) => {
		log.trace('test: received notification:' + notification);
	};
	let onChunk = (chunk: IChunk) => {};
	const promise = indexAsync(fileToIndex, outPath, 'TAG', { chunkSize: 500 })
		.then(() => {
			const hrend = process.hrtime(hrstart);
			const ms = Math.round(hrend[0] * 1000 + hrend[1] / 1000000);
			clearTimeout(timerId);
			log.trace('first event emitter task finished');
			log.info('Execution time for indexing : %dms', ms);
		})
		.catch((error: Error) => {
			log.trace(`Failed with error: ${error.message}`);
		})
		.canceled(() => {
			log.trace(`Operation was canceled`);
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
		log.trace('cancelling operation after timeout');
		promise.abort();
	}, 500);
}

function testVeryShortIndexing() {
	const outPath = examplePath + '/indexing/test.out';
	const hrstart = process.hrtime();
	let chunks: number = 0;
	let onProgress = (ticks: ITicks) => {
		log.trace('progress: ' + ticks);
	};
	let onNotification = (notification: INeonNotification) => {
		log.trace('testVeryShortIndexing: received notification:' + JSON.stringify(notification));
	};
	let onChunk = (chunk: IChunk) => {
		chunks += 1;
		if (chunks % 100 === 0) {
			process.stdout.write('.');
		}
	};
	indexAsync(examplePath + '/indexing/access_tiny.log', outPath, 'TAG', { chunkSize: 500 })
		.then(() => {
			const hrend = process.hrtime(hrstart);
			const ms = Math.round(hrend[0] * 1000 + hrend[1] / 1000000);
			log.trace('first event emitter task finished');
			log.info('Execution time for indexing : %dms', ms);
		})
		.catch((error: Error) => {
			log.trace(`Failed with error: ${error.message}`);
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
}
