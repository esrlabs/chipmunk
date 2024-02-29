import { ChartDefinition, ChartType } from '../chart';

import * as validator from '../../env/obj';

function validate(def: ChartDefinition): ChartDefinition {
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
}

export { ChartDefinition, ChartType, validate };
