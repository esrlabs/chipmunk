import { BookmarkDefinition } from '../bookmark';

import * as validator from '../../env/obj';

const protocols: { [key: string]: (def: BookmarkDefinition) => BookmarkDefinition } = {
    '0.0.1': (def: BookmarkDefinition): BookmarkDefinition => {
        validator.isObject(def);
        def.position = validator.getAsValidNumber(def, 'position');
        return def;
    },
};

export function getValidator(protocol: string): (def: BookmarkDefinition) => BookmarkDefinition {
    if (protocols[protocol] === undefined) {
        throw new Error(`No bookmarks protocol v${protocol} is found`);
    }
    return protocols[protocol];
}

export { BookmarkDefinition, protocols };
