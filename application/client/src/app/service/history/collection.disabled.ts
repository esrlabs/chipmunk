import { Collection } from './collection';
import { DisabledRequest } from '../session/dependencies/search/disabled/request';
import { Extractor } from '@platform/types/storage/json';

export class DisabledCollection extends Collection<DisabledRequest> {
    constructor() {
        super('DisabledCollection', []);
    }

    public isSame(collection: Collection<DisabledRequest>): boolean {
        if (this.elements.size !== collection.elements.size) {
            return false;
        }
        let found = 0;
        let elements = Array.from(this.elements.values());
        collection.elements.forEach((outside) => {
            found += elements.find((f) => f.isSame(outside)) === undefined ? 0 : 1;
        });
        return collection.elements.size === found;
    }

    public extractor(): Extractor<DisabledRequest> {
        return {
            from: (json: string): DisabledRequest | Error => {
                return DisabledRequest.fromJson(json);
            },
            key: (): string => {
                return DisabledRequest.KEY;
            },
        };
    }
}
