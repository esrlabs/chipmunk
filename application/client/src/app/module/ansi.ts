import { error } from '@platform/log/utils';

import * as wasm from '@loader/wasm';

export function ansiToHtml(input: string): string | Error {
    try {
        return wasm.getBindings().convert(input);
    } catch (e) {
        return new Error(error(e));
    }
}

export function escapeAnsi(input: string): string | Error {
    try {
        return wasm.getBindings().escape(input);
    } catch (e) {
        return new Error(error(e));
    }
}
