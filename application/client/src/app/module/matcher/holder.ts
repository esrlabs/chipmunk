import { Matcher } from '@matcher/index';

export abstract class Holder {
    protected readonly matcher: Matcher;

    constructor() {
        this.matcher = Matcher.new();
    }
}
