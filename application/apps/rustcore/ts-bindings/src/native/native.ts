import * as path from 'path';

export interface IRustModuleExports {
    RustSession: any;
}

export function getNativeModule(): IRustModuleExports {
    let lib: string;
    if (module.path.search('rustcore/dist') !== -1) {
        lib = module.path.replace(/rustcore\/dist.*/gi, '');
        return require(path.join(lib, '/rustcore/native/index.node'));
    } else {
        lib = module.path.replace(/ts-bindings.*/gi, '');
        return require(path.join(lib, '/ts-bindings/native/index.node'));
    }
}

const {
    RustSession: RustSessionNoType,
} = getNativeModule();

export {
    RustSessionNoType,
};