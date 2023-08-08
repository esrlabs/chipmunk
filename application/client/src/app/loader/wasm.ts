import { scope } from '@platform/env/scope';

import * as wasm_bindings from '@wasm/wasm_bindings';

export { Matcher } from '@wasm/wasm_bindings';

const wasm: {
    bindings: typeof wasm_bindings | undefined;
} = {
    bindings: undefined,
};

export function load(): Promise<void> {
    const logger = scope.getLogger('wasm');
    return Promise.all([
        import('@wasm/wasm_bindings')
            .then((module) => {
                wasm.bindings = module;
                logger.debug(`@wasm/wasm_bindings is loaded`);
            })
            .catch((err: Error) => {
                logger.error(`fail to load @wasm/wasm_bindings: ${err.message}`);
            }),
    ])
        .catch((err: Error) => {
            logger.error(`Fail to load wasm modules: ${err.message}`);
        })
        .then((_) => void 0);
}

export function getBindings(): typeof wasm_bindings {
    if (wasm.bindings === undefined) {
        throw new Error(`wasm module "ansi" isn't loaded`);
    }
    return wasm.bindings;
}
