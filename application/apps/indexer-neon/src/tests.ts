import { indexAsync, indexFile, IFilePath, IChunk } from "./processor";
import { DltFilterConf } from "./dlt";
import { StatisticInfo, library } from "./index";
import { ITicks } from "./progress";
import { log } from "./logging";
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
        min_log_level: 3,
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
            const success = library.indexDltFile({
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
            const success = library.indexDltFile({
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
            const n = library.mergeFiles({
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
            const n = library.concatFiles({
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
                timestamp = library.detectTimestampInString(
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
            const x = library.detectTimestampFormatInFile(
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
                const formats = library.detectTimestampFormatsInFiles(conf);
                console.log(formats);
            } catch (error) {
                console.error("error getting timestamp formats: %s", error);
            }
        },
    });
}
function testCallDltStats() {
    const dltPath = examplePath + "/dlt";
    const file = dltPath + "/DTC_SP21.dlt";
    measure({
        desc: "stats for " + file,
        f: () => {
            const stats: StatisticInfo = library.dltStats(file);
            console.log(util.inspect(stats, { showHidden: true, depth: 5 }));
        },
    });
}
function testIndexingAsync() {
    const hrstart = process.hrtime();
    try {
        const outPath = examplePath + "/indexing/test.out";
        let chunks: number = 0;
        let onProgress = (ticks: ITicks) => {
            log("progress: " + ticks);
        };
        let onChunk = (chunk: IChunk) => {
            chunks += 1;
            if (chunks % 100 === 0) {
                process.stdout.write(".");
            }
        };
        indexAsync(
            500,
            examplePath + "/indexing/access_huge.log",
            15000,
            outPath,
            onProgress,
            onChunk,
            "TAG",
        ).then(x => {
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
        750,
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
        750,
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
// testCallDltStats();
testIndexingAsync();
// testInterruptAsyncIndexing();
// testVeryShortIndexing();
