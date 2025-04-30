import { DictionaryEntities } from './structure/statentity';

export class Summary {
    public data: Map<string, number> = new Map();

    public inc(entity: DictionaryEntities) {
        entity.data.forEach((value: string | number, key: string) => {
            const current = this.data.get(key);
            if (typeof value === 'number') {
                this.data.set(key, current ? value + current : value);
            } else {
                this.data.set(key, current ? current + 1 : 1);
            }
        });
    }

    public reset() {
        this.data.clear();
    }

    public count(): number {
        return this.data.size;
    }
}
