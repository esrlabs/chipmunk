import {
    Modifier,
    IRequest,
    EType,
    IHTMLInjection,
    EHTMLInjectionType,
    IModifierRange,
    Modifiers,
} from 'chipmunk.client.toolkit';
import {
    shadeColor,
    scheme_color_4,
    scheme_color_0,
    getContrastColor,
} from '../../../theme/colors';
import { CColors } from '../../../conts/colors';

export interface IRange extends IModifierRange {
    bgcl: string;
}

export class HighlightsModifier extends Modifier {
    private _ranges: IRange[] = [];

    constructor(highlights: IRequest[], row: string) {
        super();
        this._map(row, highlights);
    }

    public getInjections(): IHTMLInjection[] {
        const injections: IHTMLInjection[] = [];
        this._ranges.forEach((range: IRange) => {
            const fgcl: string = getContrastColor(range.bgcl, true);
            injections.push(
                ...[
                    {
                        offset: range.start,
                        injection: `<span class="noreset match" style="background: ${range.bgcl}; color: ${fgcl};">`,
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
        this._ranges = Modifiers.obey(ranges, this._ranges) as IRange[];
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
        return 'HighlightsModifier';
    }

    private _map(row: string, highlights: IRequest[]) {
        highlights.forEach((request: IRequest) => {
            row.replace(request.reg, (match: string, ...args: any[]) => {
                const offset: number =
                    typeof args[args.length - 2] === 'number'
                        ? args[args.length - 2]
                        : args[args.length - 3];
                this._ranges.push({
                    start: offset,
                    end: offset + match.length,
                    bgcl:
                        request.background === CColors[0]
                            ? scheme_color_4
                            : request.background === undefined
                            ? scheme_color_4
                            : shadeColor(request.background, 30),
                });
                return '';
            });
        });
        // Remove conflicts
        this._ranges = Modifiers.removeCrossing(this._ranges) as IRange[];
    }
}
