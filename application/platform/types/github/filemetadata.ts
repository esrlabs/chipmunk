import { hash } from '../../env/hash';
import { SharingSettings } from './index';

import * as filters from './filter';
import * as charts from './chart';
import * as comments from './comment';
import * as bookmarks from './bookmarks';
import * as validator from '../../env/obj';
import * as utils from '../../log/utils';
import * as obj from '../../env/obj';

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

export class FileMetaData {
    constructor(public readonly def: FileMetaDataDefinition) {}

    public get(): FileMetaDataDefinition {
        return obj.clone(this.def);
    }
    public stringify(): string {
        return JSON.stringify(this.def);
    }
    public hash(): {
        full(): number;
        filters(): number;
        charts(): number;
        bookmarks(): number;
        comments(): number;
        equal(settings: SharingSettings, target: FileMetaData): boolean;
    } {
        return {
            full: (): number => {
                return hash(JSON.stringify(this.def));
            },
            filters: (): number => {
                return hash(JSON.stringify(this.def.filters));
            },
            charts: (): number => {
                return hash(JSON.stringify(this.def.charts));
            },
            bookmarks: (): number => {
                return hash(JSON.stringify(this.def.bookmarks));
            },
            comments: (): number => {
                return hash(JSON.stringify(this.def.comments));
            },
            equal: (settings: SharingSettings, target: FileMetaData): boolean => {
                if (settings.filters && this.hash().filters() !== target.hash().filters()) {
                    return false;
                }
                if (settings.charts && this.hash().charts() !== target.hash().charts()) {
                    return false;
                }
                if (settings.bookmarks && this.hash().bookmarks() !== target.hash().bookmarks()) {
                    return false;
                }
                if (settings.comments && this.hash().comments() !== target.hash().comments()) {
                    return false;
                }
                return true;
            },
        };
    }
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
