import {
    Modifier,
    EApplyTo,
    EType,
    IHTMLInjection,
    EHTMLInjectionType,
    IModifierRange,
    EAlias,
} from '../modifier';

import * as ModifiersTools from '../tools';

import { CommentState, Definition } from '@service/session/dependencies/comments/comment';

export class CommentsModifier extends Modifier {
    private _ranges: IModifierRange[] = [];
    private _comment: Definition | undefined;

    constructor(comment: Definition | undefined, position: number, row: string) {
        super();
        if (comment !== undefined) {
            this._comment = comment;
            this._map(comment, position, row);
        }
    }

    public alias(): EAlias {
        return EAlias.Comments;
    }

    public getInjections(): IHTMLInjection[] {
        if (this._comment === undefined) {
            return [];
        }
        const injections: IHTMLInjection[] = [];
        this._ranges.forEach((range: IModifierRange) => {
            injections.push(
                ...[
                    {
                        offset: range.start,
                        injection: `<span class="injected-row-comment ${
                            this._comment === undefined
                                ? ''
                                : this._comment.uuid === CommentState.pending
                                ? 'pending'
                                : ''
                        }">`,
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
        return EType.above;
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
        return 'CommentsModifier';
    }

    public override applyTo(): EApplyTo {
        return EApplyTo.output;
    }

    private _map(comment: Definition, position: number, str: string) {
        if (
            position === comment.selection.start.position &&
            position === comment.selection.end.position
        ) {
            this._ranges.push({
                start: comment.selection.start.offset,
                end: comment.selection.end.offset,
            });
        }
        if (
            position === comment.selection.start.position &&
            position !== comment.selection.end.position
        ) {
            this._ranges.push({
                start: comment.selection.start.offset,
                end: str.length,
            });
        }
        if (
            position !== comment.selection.start.position &&
            position === comment.selection.end.position
        ) {
            this._ranges.push({
                start: 0,
                end: comment.selection.end.offset,
            });
        }
        if (
            position > comment.selection.start.position &&
            position < comment.selection.end.position
        ) {
            this._ranges.push({
                start: 0,
                end: str.length,
            });
        }
    }
}
