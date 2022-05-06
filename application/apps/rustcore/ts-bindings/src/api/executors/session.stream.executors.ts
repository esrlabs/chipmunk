import { executor as SearchExecutor } from './session.stream.search.executor';
import { executor as MapExecutor } from './session.stream.map.executor';
import { executor as AssignExecutor } from './session.stream.observe.executor';
import { executor as ConcatExecutor } from './session.stream.concat.executor';
import { executor as MergeExecutor } from './session.stream.merge.executor';
import { executor as ExportExecutor } from './session.stream.export.executor';
import { executor as TimeformatDetectExecutor } from './session.stream.timeformat.detect.executor';
import { executor as ExtractExecutor } from './session.stream.extract.executor';
import { executor as NearestExecutor } from './session.stream.nearest.executor';

export const Executors = {
    search: SearchExecutor,
    map: MapExecutor,
    observe: AssignExecutor,
    concat: ConcatExecutor,
    merge: MergeExecutor,
    export: ExportExecutor,
    extract: ExtractExecutor,
    timeformatDetect: TimeformatDetectExecutor,
    nearest: NearestExecutor,
};
