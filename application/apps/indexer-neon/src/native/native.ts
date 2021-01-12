import * as path from 'path';
import ServiceProduction from '../services/service.production';

/**
 * TODO:
 * These events are major events in the scope of rust - node lifecircle,
 * it should be very well documented right here.
 */
export enum ERustEmitterEvents {
    stream = 'stream',
    search = 'search',
    map = 'map',
    matches = 'matches',
    error = 'error',
    destroyed = 'destroyed',
    ready = 'ready',
    /** ====================== Temporary events (I guess not a best naming) ==========================*/
    Done = 'Done'
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