import * as path from 'path';
import ServiceProduction from '../services/service.production';

export interface IRustModuleExports {
    RustSession: any;
}

export function getNativeModule(): IRustModuleExports {
    const lib = module.path.replace(/indexer-neon.*/gi, '');
    return require(path.join(lib, '/indexer-neon/native/index.node'));
}
// export function getNativeModule(): IRustModuleExports {
//     if (ServiceProduction.isProd()) {
//         const native = require("../../../../../native/index.node");
//         return native;
//     } else {
//         return {
//             RustEmitterEvents: {},
//             RustSession: {},
//         };
//     }
// }

const {
    RustSession: RustSessionNoType,
} = getNativeModule();

export {
    RustSessionNoType,
};