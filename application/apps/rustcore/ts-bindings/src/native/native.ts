import { v4 } from 'uuid';
import { setUuidGenerator } from 'platform/env/sequence';

import * as path from 'path';
import * as Logs from '../util/logging';

export interface IRustModuleExports {
    RustSession: any;
    UnboundJobs: any;
    Dlt: any;
    Shells: any;
    RustProgressTracker: any;
    Serial: any;
    Files: any;
    getFilterError: (filter: {
        value: string;
        is_regex: boolean;
        ignore_case: boolean;
        is_word: boolean;
    }) => string | undefined;
    execute: (filename: string, args: string[]) => Promise<void>;
}

export function getNativeModule(): IRustModuleExports {
    const modulePath = path.resolve(module.path, './index.node');
    Logs.getLogger('Native module getter').verbose(`Target: ${modulePath}`);
    return require(modulePath);
}

const { RustSession: RustSessionNoType, Dlt: RustDltTools, RustProgressTracker: ProgressTrackerNoType } = getNativeModule();

export { RustSessionNoType, RustDltTools, ProgressTrackerNoType };

setUuidGenerator(v4);
