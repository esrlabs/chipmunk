import { indexAsync, IFilePath, discoverTimespanAsync } from "./processor";
import { DltFilterConf, indexDltAsync, DltLogLevel, IIndexDltParams } from "./dlt";
import { indexer, StatisticInfo } from "./index";
import { TimeUnit } from "./units";
import {
    ITicks,
    IChunk,
    INeonTransferChunk,
    AsyncResult,
    INeonNotification,
    ITimestampFormatResult,
    IDiscoverItem,
    IConcatenatorResult,
} from "./progress";
import { log } from "./logging";
import { IConcatFilesParams, ConcatenatorInput } from "./merger";
import { StdoutController } from "custom.stdout";
import * as fs from 'fs';

const stdout = new StdoutController(process.stdout, { handleStdoutGlobal: true });

export const examplePath: String = "/Users/muellero/tmp/logviewer_usecases";

// testing
function measure({ desc, f }: { desc: String; f: () => void }) {
    const hrstart = process.hrtime();
    try {
        f();
    } catch (error) {
        console.error("error %s: %s", desc, error);
    }
    const hrend = process.hrtime(hrstart);
    const ms = Math.round(hrend[0] * 1000 + hrend[1] / 1000000);
    console.info("Execution time %s : %dms", desc, ms);
}

function testCallMergeFiles() {
    const mergePath = examplePath + "/merging/merging_big";
    const mergeConf = mergePath + "/config.json";
    const out = examplePath + "/merged.out";
    measure({
        desc: "merge with config: " + mergeConf + ", output: " + out,
        f: () => {
            const n = indexer.mergeFiles({
                configFile: mergeConf,
                out,
                append: false,
                stdout: false,
                statusUpdates: true,
            });
            console.log("merged %s lines", n);
        },
    });
}
export function testCallConcatFiles(concatConfig: string, out: string) {
    const bar = stdout.createProgressBar({ caption: "concatenating files", width: 60 });
    let onProgress = (ticks: ITicks) => {
        bar.update(Math.round((100 * ticks.ellapsed) / ticks.total));
    };
    let onResult = (res: IConcatenatorResult) => {
        log("TTT: concatenated res: " + JSON.stringify(res));
    };
    let onNotification = (notification: INeonNotification) => {
        log(
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
            const contents = fs.readFileSync(concatConfig, 'utf8');
            const config: Array<ConcatenatorInput> = JSON.parse(contents);
            const filePath = require("path").dirname(concatConfig);
            const absolutePathConfig: Array<ConcatenatorInput> = config.map((input: ConcatenatorInput) => {
                input.path = require("path").resolve(filePath, input.path);
                return input;
            });
            const [futureRes, cancel]: [Promise<AsyncResult>, () => void] = indexer.concatFilesAsync(
                absolutePathConfig,
                out,
                true,
                TimeUnit.fromSeconds(2),
                onProgress,
                onResult,
                onNotification,
            );
            futureRes.then(x => {
                log("TTT: future returned with " + JSON.stringify(x));
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
                console.error("error getting timestamp");
            }
            console.log(timestamp);
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
            console.log(x);
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
            try {
                const formats = indexer.detectTimestampFormatsInFiles(conf);
                console.log(formats);
            } catch (error) {
                console.error("error getting timestamp formats: %s", error);
            }
        },
    });
}
export function testCallDltStats(file: string) {
    const hrstart = process.hrtime();
    try {
        let onProgress = (ticks: ITicks) => {
            log("progress: " + ticks);
        };
        let onConf = (conf: StatisticInfo) => {
            log("testCallDltStats.onConf:");
            log("conf.app_ids: " + JSON.stringify(conf.app_ids));
            log("conf.ecu_ids: " + JSON.stringify(conf.ecu_ids));
            log("conf.context_ids: " + JSON.stringify(conf.context_ids));
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
                    log("COMPLETELY DONE (last result was: " + AsyncResult[x] + ")");
                    console.info("Execution time for getting DLT stats : %dms", ms);
                });
            },
        });
    } catch (error) {
        console.error("error %s", error);
    }
}

export function testDiscoverTimespanAsync(file: string) {
    const hrstart = process.hrtime();
    // const progressBar = term.progressBar({
    //     width: 80,
    //     title: "discover timestamps",
    //     eta: true,
    //     percent: true,
    // });

    try {
        let onProgress = (ticks: ITicks) => {
            // progressBar.update(ticks.ellapsed / ticks.total);
        };
        let onChunk = (chunk: ITimestampFormatResult) => {
            log("received " + JSON.stringify(chunk));
        };
        let onNotification = (notification: INeonNotification) => {
            log("testDiscoverTimespanAsync: received notification:" + JSON.stringify(notification));
        };
        let item: IDiscoverItem = { path: file };
        const [futureRes, cancel]: [Promise<AsyncResult>, () => void] = discoverTimespanAsync(
            [item],
            TimeUnit.fromSeconds(15),
            onProgress,
            onChunk,
            onNotification,
        );
        futureRes.then(x => {
            // progressBar.update(1.0);
            const hrend = process.hrtime(hrstart);
            const ms = Math.round(hrend[0] * 1000 + hrend[1] / 1000000);
            log("COMPLETELY DONE (last result was: " + AsyncResult[x] + ")");
            console.info("Execution time for indexing : %dms", ms);
        });
    } catch (error) {
        console.error("error %s", error);
    }
}

export function testDltIndexingAsync(fileToIndex: string, outPath: string) {
    log(`testDltIndexingAsync for ${fileToIndex} (out: "${outPath}")`);
    const hrstart = process.hrtime();
    // const progressBar = term.progressBar({
    //     width: 80,
    //     title: "Serious stuff in progress:",
    //     eta: true,
    //     percent: true,
    // });
    try {
        let chunks: number = 0;
        let onProgress = (ticks: ITicks) => {
            // progressBar.update(ticks.ellapsed / ticks.total);
        };
        let onChunk = (chunk: INeonTransferChunk) => {
            chunks += 1;
        };
        let notificationCount = 0;
        let onNotification = (notification: INeonNotification) => {
            notificationCount += 1;
        };
        const filterConfig: DltFilterConf = {
            min_log_level: DltLogLevel.Debug,
            // context_ids: ["DFLT"]
            // app_ids: ["NONE"],
        };

        const dltParams: IIndexDltParams = {
            dltFile: fileToIndex,
            filterConfig,
            tag: "TAG",
            out: outPath,
            chunk_size: 500,
            append: false,
            stdout: false,
            statusUpdates: true,
        };
        const [futureRes]: [Promise<AsyncResult>, () => void] = indexer.indexDltAsync(
            dltParams,
            TimeUnit.fromSeconds(60),
            onProgress,
            onChunk,
            onNotification,
        );
        futureRes.then((x: AsyncResult) => {
            // progressBar.update(1.0);
            const hrend = process.hrtime(hrstart);
            const ms = Math.round(hrend[0] * 1000 + hrend[1] / 1000000);
            log(`COMPLETELY DONE (last result was: "${AsyncResult[x]}") (notifications: ${notificationCount})`);
            console.info("Execution time for indexing : %dms", ms);
        });
    } catch (error) {
        console.error("error %s", error);
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
        let onChunk = (chunk: INeonTransferChunk) => {};
        let onNotification = (notification: INeonNotification) => {
            log("testIndexingAsync: received notification:" + JSON.stringify(notification));
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
            log("COMPLETELY DONE (last result was: " + AsyncResult[x] + ")");
            console.info("Execution time for indexing : %dms", ms);
        });
    } catch (error) {
        console.error("error %s", error);
    }
}
export function testTimedOutAsyncIndexing(fileToIndex: string, outPath: string) {
    const hrstart = process.hrtime();
    let chunks: number = 0;
    let onProgress = (ticks: ITicks) => {
        log("progress: " + ticks);
    };
    let onNotification = (notification: INeonNotification) => {
        log("test: received notification:" + notification);
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
        console.log("first event emitter task finished, result: " + AsyncResult[x]);
        console.info("Execution time for indexing : %dms", ms);
    });
}
export function testCancelledAsyncIndexing(fileToIndex: string, outPath: string) {
    const bar = stdout.createProgressBar({ caption: "concatenating files", width: 60 });
    let onProgress = (ticks: ITicks) => {
        bar.update(Math.round((100 * ticks.ellapsed) / ticks.total));
    };
    let onNotification = (notification: INeonNotification) => {
        log("test: received notification:" + notification);
    };
    const [futureRes, cancel]: [Promise<AsyncResult>, () => void] = indexAsync(
        500,
        fileToIndex,
        TimeUnit.fromMilliseconds(750),
        outPath,
        onProgress,
        (e: INeonTransferChunk) => {},
        onNotification,
        "TAG",
    );
    setTimeout(function() {
        log("cancelling operation after timeout");
        cancel();
    }, 500);

    log("res: " + futureRes);
}

function testVeryShortIndexing() {
    const outPath = examplePath + "/indexing/test.out";
    const hrstart = process.hrtime();
    let chunks: number = 0;
    let onProgress = (ticks: ITicks) => {
        log("progress: " + ticks);
    };
    let onNotification = (notification: INeonNotification) => {
        log("testVeryShortIndexing: received notification:" + JSON.stringify(notification));
    };
    const [futureRes, cancel]: [Promise<AsyncResult>, () => void] = indexAsync(
        500,
        examplePath + "/indexing/access_tiny.log",
        TimeUnit.fromMilliseconds(750),
        outPath,
        onProgress,
        (e: INeonTransferChunk) => {
            chunks += 1;
        },
        onNotification,
        "TAG",
    );
    futureRes.then((x: AsyncResult) => {
        const hrend = process.hrtime(hrstart);
        const ms = Math.round(hrend[0] * 1000 + hrend[1] / 1000000);
        console.log("first event emitter task finished, result: " + AsyncResult[x]);
        console.info("Execution time for indexing : %dms", ms);
    });
}
