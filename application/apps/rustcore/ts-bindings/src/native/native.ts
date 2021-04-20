import * as path from 'path';
import * as Logs from '../util/logging';

export interface IRustModuleExports {
    RustSession: any;
}

export function getNativeModule(): IRustModuleExports {
    Logs.getLogger('Native module getter').debug(`Target: ${path.resolve(module.path, '../../native/index.node')}`);
    const target = path.resolve(module.path, '../../native/index.node');
    return require(target);
}

const {
    RustSession: RustSessionNoType,
} = getNativeModule();

export {
    RustSessionNoType,
};