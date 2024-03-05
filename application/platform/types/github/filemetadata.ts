import * as filters from './filter';
import * as charts from './chart';
import * as comments from './comment';
import * as bookmarks from './bookmarks';
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
    bookmarks: bookmarks.BookmarkDefinition[];
    comments: comments.CommentDefinition[];
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
    return protocols[def.protocol](def, def.protocol);
}

const protocols: {
    [key: string]: (def: FileMetaDataDefinition, protocol: string) => FileMetaDataDefinition;
} = {
    '0.0.1': (def: FileMetaDataDefinition, protocol: string): FileMetaDataDefinition => {
        validator.isObject(def);
        def.filters = validator.getAsArray(def, 'filters');
        def.charts = validator.getAsArray(def, 'charts');
        def.bookmarks = validator.getAsArray(def, 'bookmarks');
        def.comments = validator.getAsArray(def, 'comments');
        def.filters.forEach((filter) => filters.getValidator(protocol)(filter));
        def.charts.forEach((chart) => charts.getValidator(protocol)(chart));
        def.comments.forEach((comment) => comments.getValidator(protocol)(comment));
        def.bookmarks.forEach((bookmark) => bookmarks.getValidator(protocol)(bookmark));
        return def;
    },
};
