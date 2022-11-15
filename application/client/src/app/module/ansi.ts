import { error } from '@platform/env/logger';

import * as wasm from '@loader/wasm';

export function ansiToHtml(input: string): string | Error {
    try {
        return wasm.getAnsi().convert(input);
    } catch (e) {
        return new Error(error(e));
    }
}
