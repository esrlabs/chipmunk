
export enum EType {
    above = 'above',            // 0 - Absolute priority
    match = 'match',            // 1 - Major
    breakable = 'breakable',    // 2 - Can be ignored. This is ASCI for example
    advanced = 'advanced',      // 2.
}
// bla bla bla <P1>bla bla <P2>bla bla</P2> bla bla bla bla bla bla bla bla bla bla bla bla</P1> bla bla bla bla bla bla
export const Priorities = [
    EType.above,
    EType.match,
    EType.breakable,
];

export interface IRequest {
    reg: RegExp;
    color: string | undefined;
    background: string | undefined;
}

export interface IModifierRange {
    start: number;
    end: number;
}

export interface IHTMLInjection {
    offset: number;
    injection: string;
}

export abstract class Modifier {

    public abstract getInjections(): IHTMLInjection[];

    public abstract obey(ranges: Required<IModifierRange>[]);

    public abstract getRanges(): Required<IModifierRange>[];

    public abstract type(): EType;

    public abstract getGroupPriority(): number;

}

export class ModifierProcessor {

    private _modifiers: Modifier[];

    static removeCrossing(ranges: Required<IModifierRange>[]): Required<IModifierRange>[] {
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

    static removeIncluded(ranges: Required<IModifierRange>[]): Required<IModifierRange>[] {
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

    static obey(master: Required<IModifierRange>[], slave: Required<IModifierRange>[]): Required<IModifierRange>[] {
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

    constructor(modifiers: Modifier[]) {
        this._modifiers = modifiers;
    }

    public parse(row: string): string {
        const injections: IHTMLInjection[] = [];
        Priorities.forEach((type: EType, index: number) => {
            const subordinateTypes: EType[] = index !== Priorities.length - 1 ? Priorities.slice(index + 1, Priorities.length) : [];
            const masters: Modifier[] = this._modifiers.filter(m => m.type() === type);
            const subordinates: Modifier[] = this._modifiers.filter(m => subordinateTypes.indexOf(m.type()) !== -1);
            if (masters.length === 0) {
                return;
            } else {
                masters.sort((a, b) => a.getGroupPriority() > b.getGroupPriority() ? 1 : -1);
                masters.forEach((master: Modifier, n: number) => {
                    for (let i = n + 1; i <= masters.length - 1; i += 1) {
                        masters[i].obey(master.getRanges());
                    }
                });
            }
            if (subordinates.length === 0) {
                return;
            } else {
                subordinates.sort((a, b) => a.getGroupPriority() > b.getGroupPriority() ? 1 : -1);
                masters.forEach((master: Modifier) => {
                    subordinates.forEach((subordinate: Modifier) => {
                        subordinate.obey(master.getRanges());
                    });
                });
            }
        });
        // this._modifiers[0].obey(this._modifiers[1].getRanges());
        this._modifiers.forEach((modifier: Modifier) => {
            injections.push(...modifier.getInjections());
        });
        injections.sort((a: IHTMLInjection, b: IHTMLInjection) => {
            return a.offset < b.offset ? 1 : -1;
        });
        injections.forEach((inj: IHTMLInjection) => {
            row = row.substring(0, inj.offset) + inj.injection + row.substring(inj.offset, row.length);
        });
        return row;
    }

}
