import { Modifier, IRequest, EType, IHTMLInjection, IModifierRange, ModifierProcessor } from './row.modifier';

export class FiltersModifier extends Modifier {

    private _ranges: IModifierRange[] = [];

    constructor(filters: IRequest[], row: string) {
        super();
        this._map(row, filters);
    }

    public getInjections(): IHTMLInjection[] {
        const injections: IHTMLInjection[] = [];
        this._ranges.forEach((range: IModifierRange) => {
            injections.push(...[{
                    offset: range.start,
                    injection: `<span class="noreset match" ">`,
                },
                {
                    offset: range.end,
                    injection: `</span>`
                }
            ]);
        });
        return injections;
    }

    public type(): EType {
        return EType.match;
    }

    public obey(ranges: Required<IModifierRange>[]) {
        this._ranges = ModifierProcessor.obey(ranges, this._ranges);
    }

    public getRanges(): Required<IModifierRange>[] {
        return this._ranges;
    }

    public getGroupPriority(): number {
        return 1;
    }

    private _map(row: string, filters: IRequest[]) {
        filters.forEach((request: IRequest) => {
            row.replace(request.reg, (match: string, ...args: any[]) => {
                const offset: number = typeof args[args.length - 2] === 'number' ? args[args.length - 2] : args[args.length - 3];
                this._ranges.push({
                    start: offset,
                    end: offset + match.length,
                });
                return '';
            });
        });
        // Remove nested ranges because it doesn't make sense,
        // because color is same
        this._ranges = ModifierProcessor.removeIncluded(this._ranges);
        // Remove conflicts
        this._ranges = ModifierProcessor.removeCrossing(this._ranges);
    }

}
