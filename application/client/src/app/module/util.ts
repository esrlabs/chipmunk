import * as wasm from '@loader/wasm';

export function getFilterError(
    filter: string,
    caseSensitive: boolean,
    wholeWord: boolean,
    regex: boolean,
): string | undefined {
    try {
        const result = wasm.getBindings().get_filter_error(filter, caseSensitive, wholeWord, regex);
        return typeof result !== 'string' ? undefined : result;
    } catch (_e) {
        return undefined;
    }
}
