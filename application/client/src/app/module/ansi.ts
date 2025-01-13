import { error } from '@platform/log/utils';

import * as wasm from '@loader/wasm';

let mapper: any = undefined;

export function ansiToHtml(input: string): string | Error {
    try {
        return wasm.getBindings().convert(input);
    } catch (e) {
        return new Error(error(e));
    }
}

export interface Slot {
    from: number;
    to: number;
    color: string | null;
    background: string | null;
    bold: boolean;
    italic: boolean;
}

export function getAnsiMap(input: string): Slot[] | Error {
    if (mapper === undefined) {
        mapper = wasm.getBindings().AnsiMapper.new();
    }
    try {
        return mapper.get_map(input);
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

export function safeEscapeAnsi(input: string): string {
    try {
        return wasm.getBindings().escape(input);
    } catch (_e) {
        return input;
    }
}
