import { CancelablePromise } from './promise';
import * as Processor from './processor';
import * as Progress from './progress';
import * as DLT from './dlt';
import * as Merge from './merger';
import * as Units from './units';

export { CancelablePromise, Processor, Progress, DLT, Merge, Units };

export default {
	// DLT
	dltStatsAsync: DLT.dltStatsAsync,
	exportDltFile: DLT.exportDltFile,
	indexDltAsync: DLT.indexDltAsync,
	dltOverSocket: DLT.dltOverSocket,
	indexPcapDlt: DLT.indexPcapDlt,
	// Indexing
	indexAsync: Processor.indexAsync,
	discoverTimespanAsync: Processor.discoverTimespanAsync,
	exportLineBased: Processor.exportLineBased,
	// Merging
	mergeFilesAsync: Merge.mergeFilesAsync,
	concatFilesAsync: Merge.concatFilesAsync,
	checkFormat: Processor.checkFormat,
};
