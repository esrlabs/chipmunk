import {
    Modifier,
    EType,
    IHTMLInjection,
    EHTMLInjectionType,
    IModifierRange,
    EAlias,
} from '../modifier';
import { ChartRequest } from '../../charts/request';

import * as Colors from '@styles/colors';
import * as ModifiersTools from '../tools';

export interface IRange extends IModifierRange {
    bgcl: string;
}

export class ChartsModifier extends Modifier {
    private _ranges: IRange[] = [];
    private _matched: ChartRequest | undefined;

    constructor(highlights: ChartRequest[], row: string) {
        super();
        this._map(row, highlights);
    }

    public alias(): EAlias {
        return EAlias.Charts;
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
        return 'ChartsModifier';
    }

    public matched(): ChartRequest | undefined {
        return this._matched;
    }

    private _map(row: string, highlights: ChartRequest[]) {
        highlights.forEach((request: ChartRequest) => {
            row.replace(request.as().serializedRegExp(), (match: string, ...args: any[]) => {
                const offset: number =
                    typeof args[args.length - 2] === 'number'
                        ? args[args.length - 2]
                        : args[args.length - 3];
                this._ranges.push({
                    start: offset,
                    end: offset + match.length,
                    bgcl:
                        request.definition.color === Colors.CColors[0]
                            ? Colors.scheme_color_4
                            : request.definition.color === undefined
                            ? Colors.scheme_color_4
                            : Colors.shadeColor(request.definition.color, 30),
                });
                this._matched = request;
                return '';
            });
        });
        // Remove conflicts
        this._ranges = ModifiersTools.removeCrossing(this._ranges) as IRange[];
    }
}
