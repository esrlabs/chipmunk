import { indexAsync, indexFile, IFilePath } from "./processor";
import { DltFilterConf, indexDltAsync, DltLogLevel, IIndexDltParams } from "./dlt";
import { indexer, StatisticInfo } from "./index";
import { TimeUnit } from "./units";
import { ITicks, IChunk, INeonTransferChunk } from "./progress";
import { log } from "./logging";
import { puts } from "util";
var ProgressBar = require("progress");
const util = require("util");

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
function testCallIndexFile() {
    const fileToIndex = examplePath + "/indexing/access.log";
    // index a file
    measure({
        desc: "indexing " + fileToIndex,
        f: () => {
            const formats = indexFile({
                file: fileToIndex,
                tag: "TAG",
                out: examplePath + "/indexing/test.out",
                append: false,
                stdout: false,
                timestamps: false,
                statusUpdates: true,
            });
            console.log(formats);
        },
    });
}

function testCallIndexDltFile() {
    const dltPath = examplePath + "/dlt";
    // const fileToIndex = dltPath + "/testfile.dlt";
    const fileToIndex = dltPath + "/DTC_SP21.dlt";
    const out_filtered = dltPath + "/dlt.indexed_filtered.out";
    const filterConf: DltFilterConf = {
        min_log_level: DltLogLevel.Debug,
        app_ids: [
            "APP",
            "rtcS",
            "DA1",
            "mete",
            "upda",
            "PDRM",
            "DLTD",
            "IRC",
            "DANL",
            "PVSn",
            "SYS",
            "PAGY",
        ],
        ecu_ids: [],
    };

    measure({
        desc: "indexing DLT " + fileToIndex,
        f: () => {
            const success = indexer.indexDltFile({
                dltFile: fileToIndex,
                tag: "TAG",
                filterConfig: filterConf,
                out: out_filtered,
                append: false,
                stdout: false,
                statusUpdates: true,
            });
            console.log("was ok?: %s", success);
        },
    });
    const out = dltPath + "/dlt.indexed.out";
    measure({
        desc: "indexing DLT (no filter config) " + fileToIndex + ", output: " + out,
        f: () => {
            const success = indexer.indexDltFile({
                dltFile: fileToIndex,
                tag: "TAG",
                out,
                append: false,
                stdout: false,
                statusUpdates: true,
            });
            console.log("was ok?: %s", success);
        },
    });
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
function testCallConcatFiles() {
    const concatConfig = examplePath + "/concat/concat.json.conf";
    const out = examplePath + "/concat/concatenated.out";
    measure({
        desc: "concatenate with config: " + concatConfig + ", output: " + out,
        f: () => {
            const n = indexer.concatFiles({
                configFile: concatConfig,
                out,
                append: false,
                stdout: false,
                statusUpdates: true,
            });
            console.log("concatenated %s lines", n);
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
                indexer.dltStatsAsync(file, TimeUnit.fromSeconds(60), onProgress, onConf).then(x => {
                    const hrend = process.hrtime(hrstart);
                    const ms = Math.round(hrend[0] * 1000 + hrend[1] / 1000000);
                    log("COMPLETELY DONE (last result was: " + x + ")");
                    console.info("Execution time for getting DLT stats : %dms", ms);
                });
            },
        });
    } catch (error) {
        console.error("error %s", error);
    }
}
export function testDltIndexingAsync(fileToIndex: string, outPath: string) {
    const hrstart = process.hrtime();
    var bar: any = undefined;
    try {
        let chunks: number = 0;
        let onProgress = (ticks: ITicks) => {
            if (bar === undefined) {
                bar = new ProgressBar(":bar", { total: ticks.total });
            }
            bar.update(ticks.ellapsed/ticks.total);
        };
        let onChunk = (chunk: INeonTransferChunk) => {
            chunks += 1;
            log("chunk: " + chunk.b + " -> " + chunk.r);
        };
        const filterConfig: DltFilterConf = {
            min_log_level: DltLogLevel.Debug,
            // context_ids: ["DFLT"]
            // app_ids: ["NONE"],
            //     "APP",
            //     "rtcS",
            //     "DA1",
            //     "mete",
            //     "upda",
            //     "PDRM",
            //     "DLTD",
            //     "IRC",
            //     "DANL",
            //     "PVSn",
            //     "SYS",
            //     "PAGY",
            // ],
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
        indexDltAsync(dltParams, TimeUnit.fromSeconds(60), onProgress, onChunk).then(x => {
            if (bar !== undefined) {
                bar.update(1.0);
            }
            const hrend = process.hrtime(hrstart);
            const ms = Math.round(hrend[0] * 1000 + hrend[1] / 1000000);
            log("COMPLETELY DONE (last result was: " + x + ")");
            console.info("Execution time for indexing : %dms", ms);
        });
    } catch (error) {
        console.error("error %s", error);
    }
}
export function testIndexingAsync() {
    const hrstart = process.hrtime();
    var bar: any = undefined;
    try {
        const outPath = examplePath + "/indexing/test.out";
        let chunks: number = 0;
        let onProgress = (ticks: ITicks) => {
            if (bar === undefined) {
                bar = new ProgressBar(":bar", { total: ticks.total });
            }
            bar.update(ticks.ellapsed/ticks.total);
        };
        let onChunk = (chunk: INeonTransferChunk) => {
            chunks += 1;
            if (chunks % 100 === 0) {
                // process.stdout.write(".");
            }
        };
        indexAsync(
            500,
            examplePath + "/indexing/access_huge.log",
            TimeUnit.fromSeconds(15),
            outPath,
            onProgress,
            onChunk,
            "TAG",
        ).then(x => {
            if (bar !== undefined) {
                bar.update(1.0);
            }
            const hrend = process.hrtime(hrstart);
            const ms = Math.round(hrend[0] * 1000 + hrend[1] / 1000000);
            log("COMPLETELY DONE (last result was: " + x + ")");
            console.info("Execution time for indexing : %dms", ms);
        });
    } catch (error) {
        console.error("error %s", error);
    }
}
function testInterruptAsyncIndexing() {
    const outPath = examplePath + "/indexing/test.out";
    const hrstart = process.hrtime();
    let chunks: number = 0;
    let onProgress = (ticks: ITicks) => {
        log("progress: " + ticks);
    };
    indexAsync(
        500,
        examplePath + "/indexing/access_huge.log",
        TimeUnit.fromMilliseconds(750),
        outPath,
        onProgress,
        (e: any) => {
            chunks += 1;
            if (chunks % 100 === 0) {
                process.stdout.write(".");
            }
        },
        "TAG",
    ).then(x => {
        const hrend = process.hrtime(hrstart);
        const ms = Math.round(hrend[0] * 1000 + hrend[1] / 1000000);
        console.log("first event emitter task finished, result: " + x);
        console.info("Execution time for indexing : %dms", ms);
    });
}
function testVeryShortIndexing() {
    const outPath = examplePath + "/indexing/test.out";
    const hrstart = process.hrtime();
    let chunks: number = 0;
    let onProgress = (ticks: ITicks) => {
        log("progress: " + ticks);
    };
    indexAsync(
        500,
        examplePath + "/indexing/access_tiny.log",
        TimeUnit.fromMilliseconds(750),
        outPath,
        onProgress,
        (e: any) => {
            chunks += 1;
            log("chunk: " + JSON.stringify(e));
        },
        "TAG",
    ).then(x => {
        const hrend = process.hrtime(hrstart);
        const ms = Math.round(hrend[0] * 1000 + hrend[1] / 1000000);
        console.log("first event emitter task finished, result: " + x);
        console.info("Execution time for indexing : %dms", ms);
    });
}

// testCallIndexFile();
// testDetectTimestampInString();
// testDetectTimestampInFile();
// testDetectTimestampFormatsInFiles();
// testCallConcatFiles();
// testCallMergeFiles();
// testCallIndexDltFile();
// testCallDltStats(examplePath + "/dlt/DTC_SP21.dlt");
// testIndexingAsync();
// testInterruptAsyncIndexing();
// testVeryShortIndexing();
// testDltIndexingAsync("./tests/testfile.dlt", "./out/testfile.out");
