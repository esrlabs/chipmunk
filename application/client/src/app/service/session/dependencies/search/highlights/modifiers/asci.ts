import {
    Modifier,
    EType,
    IHTMLInjection,
    EHTMLInjectionType,
    IModifierRange,
    EAlias,
} from '../modifier';
import { getAnsiMap, Slot } from '@module/ansi';

import * as ModifiersTools from '../tools';

export interface IRange extends IModifierRange {
    bgcl: string | undefined;
    fgcl: string | undefined;
}

export class AsciModifier extends Modifier {
    protected ranges: IRange[] = [];

    constructor(row: string) {
        super();
        const map = getAnsiMap(row);
        if (map instanceof Error) {
            return;
        }
        this.ranges = map
            .filter((slot: Slot) => slot.background !== undefined || slot.color !== undefined)
            .map((slot: Slot) => {
                return {
                    start: slot.from,
                    end: slot.to,
                    bgcl: typeof slot.background !== 'string' ? undefined : slot.background,
                    fgcl: typeof slot.color !== 'string' ? undefined : slot.color,
                };
            });
        // Remove conflicts
        this.ranges = ModifiersTools.removeCrossing(this.ranges) as IRange[];
    }

    public alias(): EAlias {
        return EAlias.Filters;
    }

    public getInjections(): IHTMLInjection[] {
        const injections: IHTMLInjection[] = [];
        this.ranges.forEach((range: IRange) => {
            injections.push(
                ...[
                    {
                        offset: range.start,
                        injection: `<span style="${
                            range.bgcl !== undefined ? `background: ${range.bgcl};` : ''
                        } ${range.fgcl !== undefined ? `color: ${range.fgcl};` : ''}">`,
                        type: EHTMLInjectionType.open,
                    },
                    {
                        offset: range.end,
                        injection: `</span>`,
                        type: EHTMLInjectionType.close,
                    },
                ],
            );
        });
        return injections;
    }

    public type(): EType {
        return EType.match;
    }

    public obey(ranges: Array<Required<IModifierRange>>) {
        this.ranges = ModifiersTools.obey(ranges, this.ranges) as IRange[];
    }

    public getRanges(): Array<Required<IModifierRange>> {
        return this.ranges;
    }

    public getGroupPriority(): number {
        return 2;
    }

    public finalize(str: string): string {
        return str;
    }

    public getName(): string {
        return 'AsciModifier';
    }
}
