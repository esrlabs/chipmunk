import { v4 } from 'uuid';
import { setUuidGenerator } from 'platform/env/sequence';
import { scope } from 'platform/env/scope';

import * as path from 'path';
import * as fs from 'fs';

export interface IRustModuleExports {
    RustSession: any;
    UnboundJobs: any;
    RustProgressTracker: any;
}

export function getNativeModule(): IRustModuleExports {
    const modulePath = (() => {
        const paths = [
            path.resolve(module.path, './index.node'),
            // This path is actual for Jasmine tests use-cases
            path.resolve(module.path, '../../../../src/native/index.node'),
        ];
        for (const target of paths) {
            if (fs.existsSync(target)) {
                return target;
            }
        }
        throw new Error(`Fail to find modules in:\n${paths.join('\n')}`);
    })();
    scope.getLogger('Native module getter').verbose(`Target: ${modulePath}`);
    return require(modulePath);
}

const { RustSession: RustSessionNoType, RustProgressTracker: ProgressTrackerNoType } =
    getNativeModule();

export { RustSessionNoType, ProgressTrackerNoType };

setUuidGenerator(v4);
