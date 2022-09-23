import { Collection } from './collection';
import { FilterRequest } from '../session/dependencies/search/filters/request';
import { Extractor } from '@platform/types/storage/json';

export class FiltersCollection extends Collection<FilterRequest> {
    constructor() {
        super('FiltersCollection', []);
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
