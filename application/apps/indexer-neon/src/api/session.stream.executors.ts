import { executor as AppendExecutor } from './session.stream.append.executor';
import { executor as ConcatExecutor } from './session.stream.concat.executor';
import { executor as MergeExecutor } from './session.stream.merge.executor';
import { executor as ExportExecutor } from './session.stream.export.executor';
import { executor as TimeformatDetectExecutor } from './session.stream.timeformat.detect.executor';
import { executor as TimeformatExtractExecutor } from './session.stream.timeformat.detect.executor';

export const Executors = {
    append: AppendExecutor,
    concat: ConcatExecutor,
    merge: MergeExecutor,
    export: ExportExecutor,
    timeformatDetect: TimeformatDetectExecutor,
    timeformatExtract: TimeformatExtractExecutor,
};
