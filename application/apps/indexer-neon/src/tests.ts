import { indexAsync, IFilePath, discoverTimespanAsync } from "./processor";
import { DltFilterConf, DltLogLevel, IIndexDltParams } from "./dlt";
import { indexer, StatisticInfo } from "./index";
import { TimeUnit } from "./units";
import {
    ITicks,
    IChunk,
    AsyncResult,
    INeonNotification,
    ITimestampFormatResult,
    IDiscoverItem,
    IMergerItemOptions,
} from "./progress";
import * as log from "loglevel";
import { IConcatFilesParams, ConcatenatorInput } from "./merger";
import { StdoutController } from "custom.stdout";
import * as fs from "fs";

const stdout = new StdoutController(process.stdout, { handleStdoutGlobal: true });

export const examplePath: String = "/Users/muellero/tmp/logviewer_usecases";

// testing
function measure({ desc, f }: { desc: String; f: () => void }) {
    const hrstart = process.hrtime();
    try {
        f();
    } catch (error) {
        log.error("error %s: %s", desc, error);
    }
    const hrend = process.hrtime(hrstart);
    const ms = Math.round(hrend[0] * 1000 + hrend[1] / 1000000);
    log.info("Execution time %s : %dms", desc, ms);
}

export function testCallMergeFiles(mergeConf: string, out: string) {
    log.debug(`calling testCallMergeFiles with mergeConf: ${mergeConf}, out: ${out}`);
    const bar = stdout.createProgressBar({ caption: "merging files", width: 60 });
    let onProgress = (ticks: ITicks) => {
        bar.update(Math.round((100 * ticks.ellapsed) / ticks.total));
    };
    let onNotification = (notification: INeonNotification) => {
        log.debug(
            "TTT: testDiscoverTimespanAsync: received notification:" + JSON.stringify(notification),
        );
    };
    log.trace("before measure");
    measure({
        desc: "TTT: merge with config: " + mergeConf + ", output: " + out,
        f: () => {
            let merged_lines: number = 0;
            let onResult = (res: IChunk) => {
                log.trace("rowsEnd= " + JSON.stringify(res));
                merged_lines = res.rowsEnd;
            };
            log.trace("inside f measure");
            const contents = fs.readFileSync(mergeConf, "utf8");
            log.trace(`contents is: ${contents}`);
            const config: Array<IMergerItemOptions> = JSON.parse(contents);
            log.trace(`config is: ${JSON.stringify(config)}`);
            const filePath = require("path").dirname(mergeConf);
            const absolutePathConfig: Array<IMergerItemOptions> = config.map(
                (input: IMergerItemOptions) => {
                    log.trace(`input is: ${JSON.stringify(input)}`);
                    input.name = require("path").resolve(filePath, input.name);
                    return input;
                },
            );
            log.trace(`absolutePathConfig: ${JSON.stringify(absolutePathConfig)}`);
            const [futureRes, cancel]: [Promise<AsyncResult>, () => void] = indexer.mergeFilesAsync(
                absolutePathConfig,
                out,
                true,
                TimeUnit.fromSeconds(5),
                onProgress,
                onResult,
                onNotification,
            );
            futureRes.then(x => {
                log.trace("TTT: future returned with " + JSON.stringify(x));
                log.trace(`merged_lines: ${merged_lines}`);
            });
        },
    });
}
export function testCallConcatFiles(concatConfig: string, out: string) {
    const bar = stdout.createProgressBar({ caption: "concatenating files", width: 60 });
    let onProgress = (ticks: ITicks) => {
        bar.update(Math.round((100 * ticks.ellapsed) / ticks.total));
    };
    let onResult = (res: IChunk) => {
        log.trace("TTT: concatenated res: " + JSON.stringify(res));
    };
    let onNotification = (notification: INeonNotification) => {
        log.trace(
            "TTT: testDiscoverTimespanAsync: received notification:" + JSON.stringify(notification),
        );
    };
    measure({
        desc: "TTT: concatenate with config: " + concatConfig + ", output: " + out,
        f: () => {
            const concatFilesParams: IConcatFilesParams = {
                configFile: concatConfig,
                out,
                append: false,
            };
            const contents = fs.readFileSync(concatConfig, "utf8");
            const config: Array<ConcatenatorInput> = JSON.parse(contents);
            const filePath = require("path").dirname(concatConfig);
            const absolutePathConfig: Array<ConcatenatorInput> = config.map(
                (input: ConcatenatorInput) => {
                    input.path = require("path").resolve(filePath, input.path);
                    return input;
                },
            );
            const [futureRes, cancel]: [
                Promise<AsyncResult>,
                () => void,
            ] = indexer.concatFilesAsync(
                absolutePathConfig,
                out,
                true,
                100,
                TimeUnit.fromSeconds(2),
                onProgress,
                onResult,
                onNotification,
            );
            futureRes.then(x => {
                log.trace("TTT: future returned with " + JSON.stringify(x));
                // progressBar.update(1.0);
            });
        },
    });
}
function testDetectTimestampInString() {
    measure({
        desc: "detect timestamp in string",
        f: () => {
            let timestamp;
            try {
                timestamp = indexer.detectTimestampInString(
                    "109.169.248.247 - - [13/Dec/2015:18:25:11 +0100] GET /administrator",
                );
            } catch (error) {
                log.error("error getting timestamp");
            }
            log.trace(timestamp);
        },
    });
}
function testDetectTimestampInFile() {
    measure({
        desc: "detect timestamp in file",
        f: () => {
            const x = indexer.detectTimestampFormatInFile(
                examplePath + "/indexing/access_small.log",
            );
            log.trace(x);
        },
    });
}
function testDetectTimestampFormatsInFiles() {
    measure({
        desc: "detect timestamp in formats in files",
        f: () => {
            const conf: Array<IFilePath> = [
                { path: examplePath + "/indexing/access_tiny.log" },
                { path: examplePath + "/indexing/access_small.log" },
                { path: examplePath + "/indexing/access_mid.log" },
            ];
        },
    });
}
export function testCallDltStats(file: string) {
    const hrstart = process.hrtime();
    try {
        let onProgress = (ticks: ITicks) => {
            log.trace("progress: " + ticks);
        };
        let onConf = (conf: StatisticInfo) => {
            log.trace("testCallDltStats.onConf:");
            log.trace("conf.app_ids: " + JSON.stringify(conf.app_ids));
            log.trace("conf.ecu_ids: " + JSON.stringify(conf.ecu_ids));
            log.trace("conf.context_ids: " + JSON.stringify(conf.context_ids));
        };
        measure({
            desc: "stats for " + file,
            f: () => {
                const [futureRes]: [Promise<AsyncResult>, () => void] = indexer.dltStatsAsync(
                    file,
                    TimeUnit.fromSeconds(60),
                    onProgress,
                    onConf,
                );
                futureRes.then((x: AsyncResult) => {
                    const hrend = process.hrtime(hrstart);
                    const ms = Math.round(hrend[0] * 1000 + hrend[1] / 1000000);
                    log.trace("COMPLETELY DONE (last result was: " + AsyncResult[x] + ")");
                    log.info("Execution time for getting DLT stats : %dms", ms);
                });
            },
        });
    } catch (error) {
        log.error("error %s", error);
    }
}

export function testDiscoverTimespanAsync(files: string[]) {
    log.trace(`calling testDiscoverTimespanAsync with ${files}`);
    const hrstart = process.hrtime();
    const bar = stdout.createProgressBar({ caption: "discover timestamp", width: 60 });
    try {
        let onProgress = (ticks: ITicks) => {
            bar.update(Math.round((100 * ticks.ellapsed) / ticks.total));
        };
        let onChunk = (chunk: ITimestampFormatResult) => {
            log.trace("received " + JSON.stringify(chunk));
        };
        let onNotification = (notification: INeonNotification) => {
            log.trace(
                "testDiscoverTimespanAsync: received notification:" + JSON.stringify(notification),
            );
        };
        let items: IDiscoverItem[] = files.map((file: string) => {
            return {
                path: file,
            };
        });
        const [futureRes, cancel]: [Promise<AsyncResult>, () => void] = discoverTimespanAsync(
            items,
            TimeUnit.fromSeconds(15),
            onProgress,
            onChunk,
            onNotification,
        );
        futureRes.then(x => {
            const hrend = process.hrtime(hrstart);
            const ms = Math.round(hrend[0] * 1000 + hrend[1] / 1000000);
            bar.update(100);
            log.trace("COMPLETELY DONE (last result was: " + AsyncResult[x] + ")");
            log.info("Execution time for indexing : %dms", ms);
        });
    } catch (error) {
        log.error("error %s", error);
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
        this.bar.update(Math.round((100 * ticks.ellapsed) / ticks.total));
    };
    public onChunk = (_chunk: IChunk) => {};
    public onNotification = (notification: INeonNotification) => {
        this.notificationCount += 1;
    };
    public done = (x: AsyncResult) => {
        this.bar.update(100);
        const hrend = process.hrtime(this.hrstart);
        const ms = Math.round(hrend[0] * 1000 + hrend[1] / 1000000);
        log.trace(
            `COMPLETELY DONE (last result was: "${AsyncResult[x]}") (notifications: ${this.notificationCount})`,
        );
        log.info("Execution time for indexing : %dms", ms);
    };
}
export function testCancelledAsyncDltIndexing(
    fileToIndex: string,
    outPath: string,
    timeoutMs: number,
    fibexPath?: string,
) {
    const bar = stdout.createProgressBar({ caption: "dlt indexing", width: 60 });
    let onProgress = (ticks: ITicks) => {
        bar.update(Math.round((100 * ticks.ellapsed) / ticks.total));
    };
    let onNotification = (notification: INeonNotification) => {
        log.trace("test: received notification:" + notification);
    };
    let helper = new IndexingHelper("dlt async indexing");
    const filterConfig: DltFilterConf = {
        min_log_level: DltLogLevel.Debug,
    };

    const dltParams: IIndexDltParams = {
        dltFile: fileToIndex,
        filterConfig,
        fibex: fibexPath,
        tag: "TAG",
        out: outPath,
        chunk_size: 500,
        append: false,
        stdout: false,
        statusUpdates: true,
    };
    const [futureRes, cancel]: [Promise<AsyncResult>, () => void] = indexer.indexDltAsync(
        dltParams,
        TimeUnit.fromSeconds(60),
        helper.onProgress,
        helper.onChunk,
        helper.onNotification,
    );
    setTimeout(function() {
        log.trace("cancelling operation after timeout");
        cancel();
    }, 500);

    log.trace("res: " + futureRes);
}
export function testDltIndexingAsync(
    fileToIndex: string,
    outPath: string,
    timeoutMs: number,
    fibexPath?: string,
) {
    log.trace(`testDltIndexingAsync for ${fileToIndex} (out: "${outPath}")`);
    let helper = new IndexingHelper("dlt async indexing");
    try {
        const filterConfig: DltFilterConf = {
            min_log_level: DltLogLevel.Debug,
        };

        const dltParams: IIndexDltParams = {
            dltFile: fileToIndex,
            filterConfig,
            fibex: fibexPath,
            tag: "TAG",
            out: outPath,
            chunk_size: 500,
            append: false,
            stdout: false,
            statusUpdates: true,
        };
        log.trace("calling indexDltAsync with fibex: " + fibexPath);
        const [futureRes, cancel]: [Promise<AsyncResult>, () => void] = indexer.indexDltAsync(
            dltParams,
            TimeUnit.fromSeconds(60),
            helper.onProgress,
            helper.onChunk,
            helper.onNotification,
        );
        futureRes.then((x: AsyncResult) => {
            helper.done(x);
        });
        setTimeout(function() {
            log.trace("cancelling operation after timeout");
            cancel();
        }, timeoutMs);
    } catch (error) {
        log.error("error %s", error);
    }
}
export function testIndexingAsync(inFile: string, outPath: string) {
    const hrstart = process.hrtime();
    const bar = stdout.createProgressBar({ caption: "index file", width: 60 });
    try {
        let chunks: number = 0;
        let onProgress = (ticks: ITicks) => {
            bar.update(Math.round((100 * ticks.ellapsed) / ticks.total));
        };
        let onChunk = (chunk: IChunk) => {};
        let onNotification = (notification: INeonNotification) => {
            log.trace("testIndexingAsync: received notification:" + JSON.stringify(notification));
        };
        const [futureRes, cancel]: [Promise<AsyncResult>, () => void] = indexAsync(
            500,
            inFile,
            TimeUnit.fromSeconds(15),
            outPath,
            onProgress,
            onChunk,
            onNotification,
            "TAG",
        );
        futureRes.then(x => {
            bar.update(100);
            const hrend = process.hrtime(hrstart);
            const ms = Math.round(hrend[0] * 1000 + hrend[1] / 1000000);
            log.trace("COMPLETELY DONE (last result was: " + AsyncResult[x] + ")");
            log.info("Execution time for indexing : %dms", ms);
        });
    } catch (error) {
        log.error("error %s", error);
    }
}
export function testTimedOutAsyncIndexing(fileToIndex: string, outPath: string) {
    const hrstart = process.hrtime();
    let chunks: number = 0;
    let onProgress = (ticks: ITicks) => {
        log.trace("progress: " + ticks);
    };
    let onNotification = (notification: INeonNotification) => {
        log.trace("test: received notification:" + notification);
    };
    const [futureRes, cancel]: [Promise<AsyncResult>, () => void] = indexAsync(
        500,
        fileToIndex,
        TimeUnit.fromMilliseconds(750),
        outPath,
        onProgress,
        (e: any) => {
            chunks += 1;
            if (chunks % 100 === 0) {
                process.stdout.write(".");
            }
        },
        onNotification,
        "TAG",
    );
    futureRes.then((x: AsyncResult) => {
        const hrend = process.hrtime(hrstart);
        const ms = Math.round(hrend[0] * 1000 + hrend[1] / 1000000);
        log.trace("first event emitter task finished, result: " + AsyncResult[x]);
        log.info("Execution time for indexing : %dms", ms);
    });
}
export function testCancelledAsyncIndexing(fileToIndex: string, outPath: string) {
    const bar = stdout.createProgressBar({ caption: "concatenating files", width: 60 });
    let onProgress = (ticks: ITicks) => {
        bar.update(Math.round((100 * ticks.ellapsed) / ticks.total));
    };
    let onNotification = (notification: INeonNotification) => {
        log.trace("test: received notification:" + notification);
    };
    const [futureRes, cancel]: [Promise<AsyncResult>, () => void] = indexAsync(
        500,
        fileToIndex,
        TimeUnit.fromMilliseconds(750),
        outPath,
        onProgress,
        (_c: IChunk) => {},
        onNotification,
        "TAG",
    );
    setTimeout(function() {
        log.trace("cancelling operation after timeout");
        cancel();
    }, 500);

    log.trace("res: " + futureRes);
}

function testVeryShortIndexing() {
    const outPath = examplePath + "/indexing/test.out";
    const hrstart = process.hrtime();
    let chunks: number = 0;
    let onProgress = (ticks: ITicks) => {
        log.trace("progress: " + ticks);
    };
    let onNotification = (notification: INeonNotification) => {
        log.trace("testVeryShortIndexing: received notification:" + JSON.stringify(notification));
    };
    const [futureRes, cancel]: [Promise<AsyncResult>, () => void] = indexAsync(
        500,
        examplePath + "/indexing/access_tiny.log",
        TimeUnit.fromMilliseconds(750),
        outPath,
        onProgress,
        (_c: IChunk) => {
            chunks += 1;
        },
        onNotification,
        "TAG",
    );
    futureRes.then((x: AsyncResult) => {
        const hrend = process.hrtime(hrstart);
        const ms = Math.round(hrend[0] * 1000 + hrend[1] / 1000000);
        log.trace("first event emitter task finished, result: " + AsyncResult[x]);
        log.info("Execution time for indexing : %dms", ms);
    });
}
