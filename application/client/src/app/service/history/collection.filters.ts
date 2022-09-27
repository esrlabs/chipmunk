import { Collection } from './collection';
import { FilterRequest } from '../session/dependencies/search/filters/request';
import { Extractor } from '@platform/types/storage/json';
import { Equal } from '@platform/types/env/types';

export class FiltersCollection extends Collection<FilterRequest> implements Equal<FiltersCollection> {
    constructor() {
        super('FiltersCollection', []);
    }

    public isSame(collection: Collection<FilterRequest>): boolean {
        if (this.elements.size !== collection.elements.size) {
            return false;
        }
        let found = 0;
        const elements = Array.from(this.elements.values());
        collection.elements.forEach((outside) => {
            found += elements.find((f) => f.isSame(outside)) === undefined ? 0 : 1;
        });
        return collection.elements.size === found;
    }

    public extractor(): Extractor<FilterRequest> {
        return {
            from: (json: string): FilterRequest | Error => {
                return FilterRequest.fromJson(json);
            },
            key: (): string => {
                return FilterRequest.KEY;
            },
        };
    }
}
