import { IFilterFlags } from '../types/filter';
import { serialize, fromStr } from './regex';

export function getSearchRegExp(request: string, flags: IFilterFlags): RegExp {
    if (flags.reg) {
        return fromStr(
            flags.word ? `\\b${request}\\b` : request,
            `g${flags.cases ? '' : 'i'}m`,
        ) as RegExp;
    } else if (flags.word) {
        return fromStr(`\\b${serialize(request)}\\b`, `g${flags.cases ? '' : 'i'}m`) as RegExp;
    } else {
        return fromStr(`${serialize(request)}`, `g${flags.cases ? '' : 'i'}m`) as RegExp;
    }
}

export function getMarkerRegExp(request: string, flags: IFilterFlags): RegExp {
    if (flags.reg) {
        return fromStr(
            flags.word ? `\\b${request}\\b` : request,
            `g${flags.cases ? '' : 'i'}m`,
        ) as RegExp;
    } else if (flags.word) {
        return fromStr(`\\b${serialize(request)}\\b`, `g${flags.cases ? '' : 'i'}m`) as RegExp;
    } else {
        return fromStr(serialize(request), `g${flags.cases ? '' : 'i'}m`) as RegExp;
    }
}

export function hasGroups(strReg: string): boolean {
    strReg = strReg.replaceAll('\\(', '').replaceAll('\\)', '');
    const left = strReg.split('').filter((s) => s === '(').length;
    const right = strReg.split('').filter((s) => s === ')').length;
    return left >= 1 ? left === right : false;
}
