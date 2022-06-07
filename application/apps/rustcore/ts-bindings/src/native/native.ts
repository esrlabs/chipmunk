import * as path from 'path';
import * as Logs from '../util/logging';

export interface IRustModuleExports {
    RustSession: any;
    Dlt: any;
    RustMatcher: any;
}

export function getNativeModule(): IRustModuleExports {
    const modulePath = path.resolve(module.path, '../../native/index.node');
    Logs.getLogger('Native module getter').debug(`Target: ${modulePath}`);
    return require(modulePath);
}

const {
    RustSession: RustSessionNoType,
    Dlt: RustDltTools,
    RustMatcher: RustMatcherNoType,
} = getNativeModule();

export { RustSessionNoType, RustDltTools, RustMatcherNoType };
