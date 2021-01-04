import * as path from 'path';
import ServiceProduction from '../services/service.production';

export interface IRustModuleExports {
    RustSession: any;
}

export function getNativeModule(): IRustModuleExports {
    const lib = module.path.replace(/indexer-neon.*/gi, '');
    return require(path.join(lib, '/indexer-neon/native/index.node'));
}

const {
    RustSession: RustSessionNoType,
} = getNativeModule();

export {
    RustSessionNoType,
};