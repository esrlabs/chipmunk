import { IFilterFlags } from '../types/filter';
import { serialize, fromStr } from './regex';

export function getMarkerRegExp(request: string, flags: IFilterFlags): RegExp {
    // Common regex for to all scenarios.
    // Note: The 'm' (multiline) flag is crucial for negation to work on a line-by-line basis.
    const regexFlags = `g${flags.cases ? '' : 'i'}m`;

    let pattern = flags.reg ? request : serialize(request);
    if (flags.word) {
        pattern = `\\b${pattern}\\b`;
    }

    // Negative lookahead on 'invert' flag.
    if (flags.invert) {
        const invertPattern = `^((?!${pattern}).)*$`;
        return fromStr(invertPattern, regexFlags) as RegExp;
    }

    return fromStr(pattern, regexFlags) as RegExp;
}

export function hasGroups(strReg: string): boolean {
    strReg = strReg.replaceAll('\\(', '').replaceAll('\\)', '');
    const left = strReg.split('').filter((s) => s === '(').length;
    const right = strReg.split('').filter((s) => s === ')').length;
    return left >= 1 ? left === right : false;
}
