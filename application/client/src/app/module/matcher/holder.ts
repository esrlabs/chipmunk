import { Matcher } from '@matcher/matcher';

export abstract class Holder {
    protected readonly matcher: Matcher;

    constructor() {
        this.matcher = Matcher.new();
    }
}
