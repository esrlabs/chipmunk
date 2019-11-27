import { CancelablePromise } from './promise';
import * as Processor from './processor';
import * as Progress from './progress';
import * as DLT from './dlt';
import * as Merge from './merger';
import * as Units from './units';

export { CancelablePromise, Processor, Progress, DLT, Merge, Units };

export default {
    // DLT
    dltStatsAsync               : DLT.dltStatsAsync,
    indexDltAsync               : DLT.indexDltAsync,
    // Indexing
    indexAsync                  : Processor.indexAsync,
    detectTimestampInString     : Processor.detectTimestampInString,
    detectTimestampFormatInFile : Processor.detectTimestampFormatInFile,
    discoverTimespanAsync       : Processor.discoverTimespanAsync,
    // Merging
    mergeFilesAsync             : Merge.mergeFilesAsync,
    concatFilesAsync            : Merge.concatFilesAsync,
};
