import ServiceProduction from '../services/service.production';

export interface IRustModuleExports {
    RustEmitterEvents: any;
    RustSession: any;
}

export function getNativeModule(): IRustModuleExports {
    if (ServiceProduction.isProd()) {
        const native = require("../../native/index.node");
        return native;
    } else {
        return {
            RustEmitterEvents: {},
            RustSession: {},
        };    
    }
}

const {
    RustEmitterEvents: RustEmitterEvents,
    RustSession: RustSessionChannelNoType,
} = getNativeModule();

const addon = getNativeModule();

export enum ERustEmitterEvents {
    error = 'error',
    destroyed = 'destroyed',
    ready = 'ready',
}

export type TEventEmitter = (name: ERustEmitterEvents, data: any) => void;

export type RustChannelConstructorImpl<T> = new (emitter: TEventEmitter) => T;

export {
    RustEmitterEvents,
    RustSessionChannelNoType,
    addon
};