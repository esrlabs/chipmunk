import { executor as SearchExecutor } from './session.stream.search.executor';
import { executor as AssignExecutor } from './session.stream.assign.executor';
import { executor as ConcatExecutor } from './session.stream.concat.executor';
import { executor as MergeExecutor } from './session.stream.merge.executor';
import { executor as ExportExecutor } from './session.stream.export.executor';
import { executor as TimeformatDetectExecutor } from './session.stream.timeformat.detect.executor';

export const Executors = {
    search: SearchExecutor,
    assign: AssignExecutor,
    concat: ConcatExecutor,
    merge: MergeExecutor,
    export: ExportExecutor,
    timeformatDetect: TimeformatDetectExecutor,
};
