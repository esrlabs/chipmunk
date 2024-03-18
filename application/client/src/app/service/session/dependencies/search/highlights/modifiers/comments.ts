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

import { CommentState, CommentDefinition } from '@platform/types/comment';

export class CommentsModifier extends Modifier {
    protected ranges: IModifierRange[] = [];
    protected readonly comment: CommentDefinition | undefined;

    protected setRange(
        comment: CommentDefinition,
        position: number,
        str: string,
        columns?: { column: number; map: [number, number][] },
    ) {
        const from = columns !== undefined ? columns.map[columns.column][0] : 0;
        const to =
            columns !== undefined
                ? columns.map[columns.column][0] + columns.map[columns.column][1]
                : str.length;
        if (
            position === comment.selection.start.position &&
            position === comment.selection.end.position
        ) {
            let start = comment.selection.start.offset;
            let end = comment.selection.end.offset;
            if (from < comment.selection.start.offset && to < comment.selection.start.offset) {
                return;
            }
            if (from > comment.selection.end.offset && to > comment.selection.end.offset) {
                return;
            }
            if (from <= comment.selection.start.offset && comment.selection.start.offset <= to) {
                start = comment.selection.start.offset - from;
            } else {
                start = 0;
            }
            if (from <= comment.selection.end.offset && comment.selection.end.offset <= to) {
                end = comment.selection.end.offset - from;
            } else {
                end = str.length;
            }
            // if (from > comment.selection.start.offset && to > comment.selection.start.offset) {
            //     start = 0;
            // }
            console.log(`>>>>>>>>>> target range`);
            this.ranges.push({
                start: start < 0 ? 0 : start,
                end: end < 0 ? 0 : end,
            });
        }
        if (
            position === comment.selection.start.position &&
            position !== comment.selection.end.position
        ) {
            let start = comment.selection.start.offset;
            if (from < comment.selection.start.offset && to < comment.selection.start.offset) {
                return;
            }
            if (from <= comment.selection.start.offset && comment.selection.start.offset <= to) {
                start = comment.selection.start.offset - from;
            } else {
                start = 0;
            }
            this.ranges.push({
                start: start < 0 ? 0 : start,
                end: str.length,
            });
        }
        if (
            position !== comment.selection.start.position &&
            position === comment.selection.end.position
        ) {
            let end = comment.selection.end.offset;
            if (from > comment.selection.end.offset && to > comment.selection.end.offset) {
                return;
            }
            if (from <= comment.selection.end.offset && comment.selection.end.offset <= to) {
                end = comment.selection.end.offset - from;
            } else {
                end = str.length;
            }
            this.ranges.push({
                start: 0,
                end: end < 0 ? 0 : end,
            });
        }
        if (
            position > comment.selection.start.position &&
            position < comment.selection.end.position
        ) {
            this.ranges.push({
                start: 0,
                end: str.length,
            });
        }
    }

    constructor(
        comment: CommentDefinition | undefined,
        position: number,
        row: string,
        columns?: { column: number; map: [number, number][] },
    ) {
        super();
        if (comment !== undefined) {
            this.comment = comment;
            this.setRange(comment, position, row, columns);
        }
    }

    public alias(): EAlias {
        return EAlias.Comments;
    }

    public getInjections(): IHTMLInjection[] {
        if (this.comment === undefined) {
            return [];
        }
        const injections: IHTMLInjection[] = [];
        this.ranges.forEach((range: IModifierRange) => {
            injections.push(
                ...[
                    {
                        offset: range.start,
                        injection: `<span class="injected-row-comment ${
                            this.comment === undefined
                                ? ''
                                : this.comment.uuid === CommentState.pending
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
        this.ranges = ModifiersTools.obey(ranges, this.ranges);
    }

    public getRanges(): Array<Required<IModifierRange>> {
        return this.ranges;
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
}
