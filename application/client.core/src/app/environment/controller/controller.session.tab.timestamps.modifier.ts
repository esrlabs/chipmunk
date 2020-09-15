import { Modifier, EType, IHTMLInjection, EHTMLInjectionType, IModifierRange, Modifiers } from 'chipmunk.client.toolkit';

export class TimestampModifier extends Modifier {

    private _ranges: IModifierRange[] = [];
    private _tags: { open: string, close: string };

    constructor(formats: RegExp[], row: string, tags: { open: string, close: string }) {
        super();
        this._tags = tags;
        this._map(row, formats);
    }

    public getInjections(): IHTMLInjection[] {
        const injections: IHTMLInjection[] = [];
        this._ranges.forEach((range: IModifierRange) => {
            injections.push(...[{
                    offset: range.start,
                    injection: this._tags.open,
                    type: EHTMLInjectionType.open,
                },
                {
                    offset: range.end,
                    injection: this._tags.close,
                    type: EHTMLInjectionType.close,
                }
            ]);
        });
        return injections;
    }

    public type(): EType {
        return EType.match;
    }

    public obey(ranges: Array<Required<IModifierRange>>) {
        this._ranges = Modifiers.obey(ranges, this._ranges);
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
        return 'TimestampModifier';
    }

    private _map(row: string, formats: RegExp[]) {
        formats.forEach((format: RegExp) => {
            row.replace(format, (match: string, ...args: any[]) => {
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
        this._ranges = Modifiers.removeIncluded(this._ranges);
        // Remove conflicts
        this._ranges = Modifiers.removeCrossing(this._ranges);
    }

}
