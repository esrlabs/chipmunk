import * as path from 'path';

export interface IRustModuleExports {
    RustSession: any;
}

export function getNativeModule(): IRustModuleExports {
    console.log(module.path);
    const target = path.resolve(module.path, '../../native/index.node');
    return require(target);
}

const {
    RustSession: RustSessionNoType,
} = getNativeModule();

export {
    RustSessionNoType,
};