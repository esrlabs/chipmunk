import { CancelablePromise } from './util/promise';
import * as Processor from './api/processor';
import * as Timestamps from './api/timestamps';
import * as Exporter from './api/exporter';
import * as Progress from './util/progress';
import * as DLT from './api/dlt';
import * as Merge from './api/merger';
import * as Units from './util/units';

export { CancelablePromise, Processor, Timestamps, Exporter, Progress, DLT, Merge, Units };

export default {
	// DLT
	dltStatsAsync: DLT.dltStatsAsync,
	exportDltFile: DLT.exportDltFile,
	indexDltAsync: DLT.indexDltAsync,
	dltOverSocket: DLT.dltOverSocket,
	indexPcapDlt: DLT.indexPcapDlt,
	pcapToDlt: DLT.pcap2dlt,
	// Indexing
	indexAsync: Processor.indexAsync,
	// Timestamps
	discoverTimespanAsync: Timestamps.discoverTimespanAsync,
	checkFormat: Timestamps.checkFormat,
	exctractTimestamp: Timestamps.exctractTimestamp,
	// Export/Import
	exportLineBased: Exporter.exportLineBased,
	// Merging
	mergeFilesAsync: Merge.mergeFilesAsync,
	concatFilesAsync: Merge.concatFilesAsync,
};
