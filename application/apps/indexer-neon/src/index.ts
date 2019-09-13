const addon = require("../native");
const util = require("util");
export interface IIndexerParams {
    file: string;
    tag: string;
    out: string;
    chunk_size?: number;
    append: boolean;
    stdout: boolean;
    timestamps: boolean;
    statusUpdates: boolean;
}
export interface IMergeParams {
    configFile: String;
    out: String;
    chunk_size?: number;
    append: boolean;
    stdout: boolean;
    statusUpdates: boolean;
}
export interface IConcatFilesParams {
    configFile: String;
    out: String;
    chunk_size?: number;
    append: boolean;
    stdout: boolean;
    statusUpdates: boolean;
}
interface LevelDistribution {
    non_log: number;
    log_fatal: number;
    log_error: number;
    log_warning: number;
    log_info: number;
    log_debug: number;
    log_verbose: number;
    log_invalid: number;
}
interface StatisticInfo {
    app_ids: Array<[String, LevelDistribution]>;
    context_ids: Array<[String, LevelDistribution]>;
    ecu_ids: Array<[String, LevelDistribution]>;
}

interface DltFilterConf {
    min_log_level?: number;
    app_ids?: Array<String>;
    ecu_ids?: Array<String>;
    context_ids?: Array<String>;
}
export interface IIndexDltParams {
    dltFile: String;
    filterConfig?: DltFilterConf;
    tag: String;
    out: String;
    chunk_size?: number;
    append: boolean;
    stdout: boolean;
    statusUpdates: boolean;
}

export interface IChipmunkIndexer {
    hello: () => string;
    indexFile: (params: IIndexerParams) => boolean;
    mergeFiles: (params: IMergeParams) => boolean;
    concatFiles(params: IConcatFilesParams): boolean;
    dltStats(dltFile: String): StatisticInfo;
    indexDltFile(params: IIndexDltParams): boolean;
}

const library: IChipmunkIndexer = {
    hello: addon.hello,
    indexFile: ({ file, tag, out, chunk_size, append, stdout, timestamps, statusUpdates }) => {
        return addon.indexFile(
            file,
            tag,
            out,
            chunk_size !== undefined ? chunk_size : 5000,
            append,
            stdout,
            timestamps,
            statusUpdates,
        );
    },
    mergeFiles: ({ configFile, out, chunk_size, append, stdout, statusUpdates }) => {
        return addon.mergeFiles(
            configFile,
            out,
            chunk_size !== undefined ? chunk_size : 5000,
            append,
            stdout,
            statusUpdates,
        );
    },
    concatFiles: ({ configFile, out, chunk_size, append, stdout, statusUpdates }) => {
        return addon.concatFiles(
            configFile,
            out,
            chunk_size !== undefined ? chunk_size : 5000,
            append,
            stdout,
            statusUpdates,
        );
    },
    dltStats: (dltFile: String) => {
        return addon.dltStats(dltFile);
    },
    indexDltFile: ({
        dltFile,
        filterConfig,
        tag,
        out,
        chunk_size,
        append,
        stdout,
        statusUpdates,
    }) => {
        const usedChunkSize = chunk_size !== undefined ? chunk_size : 5000;
        if (filterConfig === undefined) {
            return addon.indexDltFile(
                dltFile,
                tag,
                out,
                usedChunkSize,
                append,
                stdout,
                statusUpdates,
            );
        } else {
            return addon.indexDltFile(
                dltFile,
                tag,
                out,
                usedChunkSize,
                append,
                stdout,
                statusUpdates,
                filterConfig,
            );
        }
    },
};

// testing
function measure(desc: String, f: () => void) {
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

const examplePath: String = "/Users/muellero/tmp/logviewer_usecases";
function testCallIndexFile() {
    const fileToIndex = examplePath + "/indexing/access.log";
    // index a file
    measure("indexing " + fileToIndex, () => {
        const formats = library.indexFile({
            file: fileToIndex,
            tag: "TAG",
            out: examplePath + "/indexing/test.out",
            append: false,
            stdout: false,
            timestamps: false,
            statusUpdates: true,
        });
        console.log(formats);
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

    measure("indexing DLT " + fileToIndex, () => {
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
    });
    const out = dltPath + "/dlt.indexed.out";
    measure("indexing DLT (no filter config) " + fileToIndex + ", output: " + out, () => {
        const success = library.indexDltFile({
            dltFile: fileToIndex,
            tag: "TAG",
            out,
            append: false,
            stdout: false,
            statusUpdates: true,
        });
        console.log("was ok?: %s", success);
    });
}
function testCallMergeFiles() {
    const mergePath = examplePath + "/merging/merging_big";
    const mergeConf = mergePath + "/config.json";
    const out = examplePath + "/merged.out";
    measure("merge with config: " + mergeConf + ", output: " + out, () => {
        const n = library.mergeFiles({
            configFile: mergeConf,
            out,
            append: false,
            stdout: false,
            statusUpdates: true,
        });
        console.log("merged %s lines", n);
    });
}
function testCallConcatFiles() {
    const concatConfig = examplePath + "/concat/concat.json.conf";
    const out = examplePath + "/concat/concatenated.out";
    measure("concatenate with config: " + concatConfig + ", output: " + out, () => {
        const n = library.concatFiles({
            configFile: concatConfig,
            out,
            append: false,
            stdout: false,
            statusUpdates: true,
        });
        console.log("concatenated %s lines", n);
    });
}
function testDetectTimestampInString() {
    measure("detect timestamp in string", () => {
        let timestamp;
        try {
            timestamp = addon.detectTimestampInString(
                "109.169.248.247 - - [13/Dec/2015:18:25:11 +0100] GET /administrator",
            );
        } catch (error) {
            console.error("error getting timestamp");
        }
        console.log(timestamp);
    });
}
function testDetectTimestampInFile() {
    measure("detect timestamp in file", () => {
        const x = addon.detectTimestampFormatInFile(examplePath + "/indexing/access_small.log");
        console.log(x);
    });
}
function testDetectTimestampFormatsInFiles() {
    measure("detect timestamp in formats in files", () => {
        var conf = [
            { path: examplePath + "/indexing/access_tiny.log" },
            { path: examplePath + "/indexing/access_small.log" },
            { path: examplePath + "/indexing/access_mid.log" },
        ];
        try {
            const formats = addon.detectTimestampFormatsInFiles(conf);
            console.log(formats);
        } catch (error) {
            console.error("error getting timestamp formats: %s", error);
        }
    });
}
function testCallDltStats() {
    const dltPath = examplePath + "/dlt";
    const file = dltPath + "/DTC_SP21.dlt";
    measure("stats for " + file, () => {
        const stats: StatisticInfo = library.dltStats(file);
        console.log(util.inspect(stats, { showHidden: true, depth: 5 }));
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

export default library;
