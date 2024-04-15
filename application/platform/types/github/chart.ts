import { ChartDefinition, ChartType } from '../chart';

import * as validator from '../../env/obj';

const protocols: { [key: string]: (def: ChartDefinition) => ChartDefinition } = {
    '0.0.1': (def: ChartDefinition): ChartDefinition => {
        validator.isObject(def);
        def.uuid = validator.getAsNotEmptyString(def, 'uuid');
        def.color = validator.getAsNotEmptyString(def, 'color');
        def.widths = validator.getAsObj(def, 'widths');
        def.widths.line = validator.getAsValidNumber(def.widths, 'line');
        def.widths.point = validator.getAsValidNumber(def.widths, 'point');
        def.filter = validator.getAsNotEmptyString(def, 'filter');
        def.active = validator.getAsBool(def, 'active');
        def.type = validator.getAsNotEmptyString(def, 'type') as ChartType;
        return def;
    },
};

export function getValidator(protocol: string): (def: ChartDefinition) => ChartDefinition {
    if (protocols[protocol] === undefined) {
        throw new Error(`No charts protocol v${protocol} is found`);
    }
    return protocols[protocol];
}

export { ChartDefinition, ChartType, protocols };
