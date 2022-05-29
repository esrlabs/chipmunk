import { IFilterFlags } from '../interfaces/interface.rust.api.general';
import { serializeRegStr, createFromStr } from './functions.regexp';

export function getSearchRegExp(request: string, flags: IFilterFlags): RegExp {
    if (flags.regexp) {
        return createFromStr(
            flags.wholeword ? `\\b${request}\\b` : request,
            `g${flags.casesensitive ? '' : 'i'}m`,
        ) as RegExp;
    } else if (flags.wholeword) {
        return createFromStr(
            `\\b${serializeRegStr(request)}\\b`,
            `g${flags.casesensitive ? '' : 'i'}m`,
        ) as RegExp;
    } else {
        return createFromStr(
            `${serializeRegStr(request)}`,
            `g${flags.casesensitive ? '' : 'i'}m`,
        ) as RegExp;
    }
}

export function getMarkerRegExp(request: string, flags: IFilterFlags): RegExp {
    if (flags.regexp) {
        return createFromStr(
            flags.wholeword ? `\\b${request}\\b` : request,
            `g${flags.casesensitive ? '' : 'i'}m`,
        ) as RegExp;
    } else if (flags.wholeword) {
        return createFromStr(
            `\\b${serializeRegStr(request)}\\b`,
            `g${flags.casesensitive ? '' : 'i'}m`,
        ) as RegExp;
    } else {
        return createFromStr(
            serializeRegStr(request),
            `g${flags.casesensitive ? '' : 'i'}m`,
        ) as RegExp;
    }
}
