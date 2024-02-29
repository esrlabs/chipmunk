import * as filters from './filter';
import * as charts from './chart';
import * as validator from '../../env/obj';
import * as utils from '../../log/utils';

export class ProtocolError extends Error {
    constructor(
        msg: string,
        public readonly supported: string[],
        public readonly declared: string,
    ) {
        super(msg);
    }
}
export interface FileMetaDataDefinition {
    protocol: string;
    filters: filters.FilterDefinition[];
    charts: charts.ChartDefinition[];
    bookmarks: number[];
}

export function fromJson(str: string): FileMetaDataDefinition | Error | ProtocolError {
    try {
        const def = JSON.parse(str);
        return validate(def);
    } catch (e) {
        return new Error(utils.error(e));
    }
}

export function validate(def: FileMetaDataDefinition): FileMetaDataDefinition {
    validator.isObject(def);
    def.protocol = validator.getAsNotEmptyString(def, 'protocol');
    if (protocols[def.protocol] === undefined) {
        throw new ProtocolError('Protocol not found', Object.keys(protocols), def.protocol);
    }
    return protocols[def.protocol](def);
}

const protocols: { [key: string]: (def: FileMetaDataDefinition) => FileMetaDataDefinition } = {
    '0.0.1': (def: FileMetaDataDefinition): FileMetaDataDefinition => {
        validator.isObject(def);
        def.filters = validator.getAsArray(def, 'filters');
        def.charts = validator.getAsArray(def, 'charts');
        def.bookmarks = validator.getAsArray(def, 'bookmarks');
        def.filters.forEach((filter) => filters.validate(filter));
        def.charts.forEach((chart) => charts.validate(chart));
        def.bookmarks.forEach((bookmark) => {
            if (typeof bookmark !== 'number' || isNaN(bookmark) || !isFinite(bookmark)) {
                throw new Error(`Bookmark position has invalid value`);
            }
        });
        return def;
    },
};
