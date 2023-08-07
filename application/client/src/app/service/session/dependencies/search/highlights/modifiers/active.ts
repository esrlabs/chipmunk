import {
    Modifier,
    EType,
    IHTMLInjection,
    EHTMLInjectionType,
    IModifierRange,
    EAlias,
} from '../modifier';
import { FilterRequest } from '../../filters/request';

import * as ModifiersTools from '../tools';

export class ActiveFilterModifier extends Modifier {
    private _ranges: IModifierRange[] = [];
    private _matched: FilterRequest | undefined;

    constructor(filters: FilterRequest[], row: string) {
        super();
        this._map(row, filters);
    }

    public alias(): EAlias {
        return EAlias.Active;
    }

    public getInjections(): IHTMLInjection[] {
        const injections: IHTMLInjection[] = [];
        this._ranges.forEach((range: IModifierRange) => {
            injections.push(
                ...[
                    {
                        offset: range.start,
                        injection: `<span class="match">`,
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
        this._ranges = ModifiersTools.obey(ranges, this._ranges);
    }

    public getRanges(): Array<Required<IModifierRange>> {
        return this._ranges;
    }

    public getGroupPriority(): number {
        return 1;
    }

    public finalize(str: string): string {
        return str;
    }

    public getName(): string {
        return 'ActiveFilterModifier';
    }

    public matched(): FilterRequest | undefined {
        return this._matched;
    }

    private _map(row: string, filters: FilterRequest[]) {
        filters.forEach((request: FilterRequest) => {
            row.replace(request.as().serializedRegExp(), (match: string, ...args: any[]) => {
                const offset: number =
                    typeof args[args.length - 2] === 'number'
                        ? args[args.length - 2]
                        : args[args.length - 3];
                this._ranges.push({
                    start: offset,
                    end: offset + match.length,
                });
                this._matched = request;
                return '';
            });
        });
        // Remove nested ranges because it doesn't make sense,
        // because color is same
        this._ranges = ModifiersTools.removeIncluded(this._ranges);
        // Remove conflicts
        this._ranges = ModifiersTools.removeCrossing(this._ranges);
    }
}
