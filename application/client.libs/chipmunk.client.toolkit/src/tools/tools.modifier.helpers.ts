import { IModifierRange } from '../classes/class.row.modifier';

export function removeCrossing(ranges: Array<Required<IModifierRange>>): Array<Required<IModifierRange>> {
    const removed: number[] = [];
    return ranges = ranges.filter((checking: IModifierRange, i: number) => {
        let excluded: boolean = false;
        ranges.forEach((range: IModifierRange, n: number) => {
            if (excluded || removed.indexOf(n) !== -1) {
                return;
            }
            if (range.start < checking.start && range.end > checking.start && range.end < checking.end) {
                excluded = true;
            }
            if (range.start < checking.end && range.end > checking.end && range.start > checking.start) {
                excluded = true;
            }
        });
        if (excluded) {
            removed.push(i);
        }
        return !excluded;
    });
}

export function removeIncluded(ranges: Array<Required<IModifierRange>>): Array<Required<IModifierRange>> {
    const removed: number[] = [];
    return ranges.filter((checking: IModifierRange, i: number) => {

        let excluded: boolean = false;
        ranges.forEach((range: IModifierRange, n: number) => {
            if (excluded || removed.indexOf(n) !== -1) {
                return;
            }
            if (range.start < checking.start && range.end > checking.end) {
                excluded = true;
            }
        });
        if (excluded) {
            removed.push(i);
        }
        return !excluded;
    });
}

export function obey(master: Array<Required<IModifierRange>>, slave: Array<Required<IModifierRange>>): Array<Required<IModifierRange>> {
    return slave.filter((checking: IModifierRange) => {
        let excluded: boolean = false;
        master.forEach((range: IModifierRange) => {
            if (excluded) {
                return;
            }
            // Prevent any crossing
            if ((range.start < checking.start && range.end > checking.start) ||
                (range.start < checking.end && range.end > checking.end)) {
                excluded = true;
            }
        });
        return !excluded;
    });
}

export function consider(master: Array<Required<IModifierRange>>, slave: Array<Required<IModifierRange>>): Array<Required<IModifierRange>> {
    return slave.filter((checking: IModifierRange) => {
        let excluded: boolean = false;
        master.forEach((range: IModifierRange) => {
            if (excluded) {
                return;
            }
            // Prevent any crossing
            if ((range.start < checking.start && range.end > checking.start) ||
                (range.start < checking.end && range.end > checking.end)) {
                excluded = true;
            }
        });
        return !excluded;
    });
}