import { Pair } from './pair';
import { Holder } from '@module/matcher';

export class State extends Holder {
    public pairs: Pair[] = [];

    constructor(pairs: Map<string, string>) {
        super();
        pairs.forEach((value, key) => {
            this.pairs.push(new Pair(key, value, this.matcher));
        });
    }

    public visible(): Pair[] {
        return this.pairs.filter((t) => !t.hidden());
    }

    public filter(value: string): void {
        this.matcher.search(value);
        this.pairs = this.pairs.sort((a, b) => b.getScore() - a.getScore());
    }
}
