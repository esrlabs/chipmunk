import { Collection } from './collection';
import { DisabledRequest } from '../session/dependencies/search/disabled/request';
import { Extractor } from '@platform/types/storage/json';

export class DisabledCollection extends Collection<DisabledRequest> {
    constructor() {
        super('DisabledCollection', []);
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
