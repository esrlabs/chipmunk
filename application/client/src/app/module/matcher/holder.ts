import * as wasm from '@loader/wasm';

export abstract class Holder {
    protected readonly matcher: wasm.Matcher;

    constructor() {
        this.matcher = wasm.getMatcher().Matcher.new();
    }
}
