import * as path from 'path';
import ServiceProduction from '../services/service.production';

export enum ERustEmitterEvents {
    stream = 'stream',
    search = 'search',
    map = 'map',
    matches = 'matches',
    error = 'error',
    destroyed = 'destroyed',
    ready = 'ready',
}

export interface IRustModuleExports {
    RustEmitterEvents: { [key: string]: ERustEmitterEvents };
    RustSession: any;
}

export function getNativeModule(): IRustModuleExports {
    const lib = module.path.replace(/indexer-neon.*/gi, '');
    return require(path.join(lib, '/indexer-neon/native/index.node'));
    /*
    if (ServiceProduction.isProd()) {
        const native = require("../../../../../native/index.node");
        return native;
    } else {
        return {
            RustEmitterEvents: {},
            RustSession: {},
        };
    }
    */
}

const {
    RustEmitterEvents: RustEmitterEvents,
    RustSession: RustSessionChannelNoType,
} = getNativeModule();

export {
    RustEmitterEvents,
    RustSessionChannelNoType,
};