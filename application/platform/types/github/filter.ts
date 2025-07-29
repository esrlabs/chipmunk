import { FilterDefinition } from '../filter';

import * as validator from '../../env/obj';

const protocols: { [key: string]: (def: FilterDefinition) => FilterDefinition } = {
    '0.0.1': (def: FilterDefinition): FilterDefinition => {
        validator.isObject(def);
        def.uuid = validator.getAsNotEmptyString(def, 'uuid');
        def.colors = validator.getAsObj(def, 'colors');
        def.colors.color = validator.getAsNotEmptyString(def.colors, 'color');
        def.colors.background = validator.getAsNotEmptyString(def.colors, 'background');
        def.filter = validator.getAsObj(def, 'filter');
        def.filter.flags = validator.getAsObj(def.filter, 'flags');
        def.filter.flags.cases = validator.getAsBool(def.filter.flags, 'cases');
        def.filter.flags.word = validator.getAsBool(def.filter.flags, 'word');
        def.filter.flags.reg = validator.getAsBool(def.filter.flags, 'reg');
        def.filter.flags.invert = validator.getAsBool(def.filter.flags, 'invert');
        def.filter.filter = validator.getAsNotEmptyString(def.filter, 'filter');
        def.active = validator.getAsBool(def, 'active');
        return def;
    },
};

export function getValidator(protocol: string): (def: FilterDefinition) => FilterDefinition {
    if (protocols[protocol] === undefined) {
        throw new Error(`No filter protocol v${protocol} is found`);
    }
    return protocols[protocol];
}

export { FilterDefinition, protocols };
