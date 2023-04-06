import { v4 } from 'uuid';
import { setUuidGenerator } from 'platform/env/sequence';

import * as path from 'path';
import * as Logs from '../util/logging';

export interface IRustModuleExports {
    RustSession: any;
    UnboundJobs: any;
    RustProgressTracker: any;
}

export function getNativeModule(): IRustModuleExports {
    const modulePath = path.resolve(module.path, './index.node');
    Logs.getLogger('Native module getter').verbose(`Target: ${modulePath}`);
    return require(modulePath);
}

const { RustSession: RustSessionNoType, RustProgressTracker: ProgressTrackerNoType } =
    getNativeModule();

export { RustSessionNoType, ProgressTrackerNoType };

setUuidGenerator(v4);
