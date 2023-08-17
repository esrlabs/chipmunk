import * as wasm from '@loader/wasm';

export type MatcherType = wasm.Matcher;

export abstract class Holder {
    protected readonly matcher: wasm.Matcher;

    constructor() {
        this.matcher = wasm.getMatcher().Matcher.new();
    }
}
