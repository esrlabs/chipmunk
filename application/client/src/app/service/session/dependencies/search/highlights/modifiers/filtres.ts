import {
    Modifier,
    EType,
    IHTMLInjection,
    EHTMLInjectionType,
    IModifierRange,
    EAlias,
} from '../modifier';
import { FilterRequest } from '../../filters/request';

import * as Colors from '@styles/colors';
import * as ModifiersTools from '../tools';

export interface IRange extends IModifierRange {
    bgcl: string;
}

export class FiltersModifier extends Modifier {
    private _ranges: IRange[] = [];
    private _matched: FilterRequest | undefined;

    constructor(highlights: FilterRequest[], row: string) {
        super();
        this._map(row, highlights);
    }

    public alias(): EAlias {
        return EAlias.Filters;
    }

    public getInjections(): IHTMLInjection[] {
        const injections: IHTMLInjection[] = [];
        this._ranges.forEach((range: IRange) => {
            const fgcl: string = Colors.getContrastColor(range.bgcl, true);
            injections.push(
                ...[
                    {
                        offset: range.start,
                        injection: `<span class="match" style="background: ${range.bgcl}; color: ${fgcl};">`,
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
        this._ranges = ModifiersTools.obey(ranges, this._ranges) as IRange[];
    }

    public getRanges(): Array<Required<IModifierRange>> {
        return this._ranges;
    }

    public getGroupPriority(): number {
        return 2;
    }

    public finalize(str: string): string {
        return str;
    }

    public getName(): string {
        return 'FiltersModifier';
    }

    public matched(): FilterRequest | undefined {
        return this._matched;
    }

    private _map(row: string, highlights: FilterRequest[]) {
        highlights.forEach((request: FilterRequest) => {
            row.replace(request.as().serializedRegExp(), (match: string, ...args: any[]) => {
                const offset: number =
                    typeof args[args.length - 2] === 'number'
                        ? args[args.length - 2]
                        : args[args.length - 3];
                this._ranges.push({
                    start: offset,
                    end: offset + match.length,
                    bgcl:
                        request.definition.colors.background === Colors.CColors[0]
                            ? Colors.scheme_color_4
                            : request.definition.colors.background === undefined
                            ? Colors.scheme_color_4
                            : Colors.shadeColor(request.definition.colors.background, 30),
                });
                this._matched = request;
                return '';
            });
        });
        // Remove conflicts
        this._ranges = ModifiersTools.removeCrossing(this._ranges) as IRange[];
    }
}
