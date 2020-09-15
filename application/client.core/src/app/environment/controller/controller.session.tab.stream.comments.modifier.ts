import { Modifier, IRequest, EType, IHTMLInjection, EHTMLInjectionType, IModifierRange, Modifiers } from 'chipmunk.client.toolkit';
import { ISelectionPoint, ICommentedSelection, IComment, IActualSelectionData} from './controller.session.tab.stream.comments.types';

export class CommentSelectionModifier extends Modifier {

    private _ranges: IModifierRange[] = [];

    constructor(comment: IComment | undefined, position: number, row: string) {
        super();
        if (comment !== undefined) {
            this._map(comment, position, row);
        }
    }

    public getInjections(): IHTMLInjection[] {
        const injections: IHTMLInjection[] = [];
        this._ranges.forEach((range: IModifierRange) => {
            injections.push(...[{
                    offset: range.start,
                    injection: `<span class="comment" style="background: red">`,
                    type: EHTMLInjectionType.open,
                },
                {
                    offset: range.end,
                    injection: `</span>`,
                    type: EHTMLInjectionType.close,
                }
            ]);
        });
        return injections;
    }

    public type(): EType {
        return EType.above;
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

    private _map(comment: IComment, position: number, str: string) {
        if (position === comment.selection.start.position && position === comment.selection.end.position) {
            this._ranges.push({
                start: comment.selection.start.offset,
                end: comment.selection.end.offset,
            });
        }
        if (position === comment.selection.start.position && position !== comment.selection.end.position) {
            this._ranges.push({
                start: comment.selection.start.offset,
                end: str.length,
            });
        }
        if (position !== comment.selection.start.position && position === comment.selection.end.position) {
            this._ranges.push({
                start: 0,
                end: comment.selection.end.offset,
            });
        }
        if (position > comment.selection.start.position && position < comment.selection.end.position) {
            this._ranges.push({
                start: 0,
                end: str.length,
            });
        }
    }

}
