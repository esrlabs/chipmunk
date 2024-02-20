import { SetupLogger, LoggerInterface } from '@platform/entity/logger';
import { ISelection } from '@ui/elements/scrollarea/controllers/selection';
import { Modifier } from '@service/session/dependencies/search/highlights/modifier';
import { CommentsModifier } from '@service/session/dependencies/search/highlights/modifiers/comments';
import {
    Definition,
    ActualSelectionData,
    CommentState,
} from '@service/session/dependencies/comments/comment';
import { Subscriber, Subject, Subjects } from '@platform/env/subscription';
import { unique } from '@platform/env/sequence';
import { popup } from '@ui/service/popup';
import { components } from '@env/decorators/initial';
import { Vertical, Horizontal } from '@ui/service/popup';
import { CShortColors } from '@styles/colors';
import { Session } from '@service/session/session';

import * as regex from '@platform/env/regex';
import * as obj from '@platform/env/obj';

/**
 
 export interface IScrollBoxSelection {
    // Cleaned from table delimiters and number delimiter (not actual)
    selection: string;
    // original selection
    original: string;
    // start row
    anchor: number;
    anchorOffset: number;
    // end row
    focus: number;
    focusOffset: number;
}

 */
@SetupLogger()
export class Comments extends Subscriber {
    protected readonly comments: Map<string, Definition> = new Map();
    protected session!: Session;

    protected getSelectedText(): string | undefined {
        const selection = document.getSelection();
        return selection === null ? undefined : selection.toString();
    }

    protected getRelevantComment(position: number): Definition[] {
        const comments: Definition[] = [];
        this.comments.forEach((comment: Definition) => {
            if (position < comment.selection.start.position) {
                return;
            }
            if (position > comment.selection.end.position) {
                return;
            }
            comments.push(comment);
        });
        return comments;
    }

    protected getActualSelectionData(
        original: string,
        selected: string,
        readFromEnd: boolean,
    ): ActualSelectionData | Error {
        function getHolder(node: HTMLElement): HTMLElement | Error {
            if (node.nodeName.toLowerCase().search('app-scrollarea-row') !== -1) {
                return node;
            }
            if (node.parentNode === null || node.parentNode === undefined) {
                return new Error(`No parent node has been found`);
            }
            return getHolder(node.parentNode as HTMLElement);
        }
        function getRegExpWithASCI(str: string): RegExp {
            let regStr: string = '';
            for (let i = 0; i < str.length; i += 1) {
                regStr += `[\\u0000-\\u001f]?(\\u001b\\[[\\d;]*[HfABCDsuJKmhIp])?${regex.serialize(
                    str[i],
                )}`;
                //         all notprintalbe | possible ASCII codes               | single char, which we are looking for
                //         symbols          |                                    |
            }
            return new RegExp(regStr);
        }
        // Collapse selection to start. We need it because anchor and focus nodes can be in any order (depends
        // on how user did selection
        const selection = window.getSelection();
        if (selection === undefined || selection === null) {
            return new Error(`No active selection`);
        }
        if (!readFromEnd) {
            selection.collapseToStart();
        } else {
            selection.collapseToEnd();
        }
        const anchorNode = selection.anchorNode;
        const anchorOffset = selection.anchorOffset;
        if (anchorNode === undefined || anchorNode === null) {
            return new Error(`No anchorNode in active selection`);
        }
        // Looking for root row node
        const holder: HTMLElement | Error = getHolder(anchorNode as HTMLElement);
        if (holder instanceof Error) {
            return holder;
        }
        // Create new selection: from begining of row to start of user's selection
        const range: Range = document.createRange();
        range.setStart(holder, 0);
        range.setEnd(anchorNode, anchorOffset);
        selection.removeAllRanges();
        selection.addRange(range);
        // Now we have text before user selection
        const before: string = selection.toString();
        selection.removeAllRanges();
        let selStartOffset: number = 0;
        let after: string = original;
        if (before.length !== 0) {
            const regBefore = getRegExpWithASCI(before);
            const matchBefore = original.match(regBefore);
            if (
                matchBefore === null ||
                matchBefore.length === 0 ||
                original.search(regBefore) === -1
            ) {
                return new Error(`Fail to catch begining of selection`);
            }
            selStartOffset = matchBefore[0].length;
            after = original.substring(selStartOffset, original.length);
        }
        if (!readFromEnd) {
            const regAfter = getRegExpWithASCI(selected);
            const matchAfter = after.match(regAfter);
            if (matchAfter === null || matchAfter.length === 0 || after.search(regAfter) === -1) {
                return new Error(`Fail to catch end of selection`);
            }
            const selEndOffset = matchAfter[0].length;
            return {
                selection: original.substring(selStartOffset, selStartOffset + selEndOffset),
                start: selStartOffset,
                end: selStartOffset + selEndOffset,
            };
        } else {
            return {
                selection: original.substring(0, selStartOffset),
                start: 0,
                end: selStartOffset,
            };
        }
    }

    public subjects: Subjects<{
        added: Subject<Definition>;
        updated: Subject<Definition>;
        pending: Subject<Definition>;
        removed: Subject<string>;
        selected: Subject<string>;
        export: Subject<void>;
    }> = new Subjects({
        added: new Subject<Definition>(),
        updated: new Subject<Definition>(),
        pending: new Subject<Definition>(),
        removed: new Subject<string>(),
        selected: new Subject<string>(),
        export: new Subject<void>(),
    });

    constructor() {
        super();
    }

    public destroy(): void {
        this.comments.clear();
    }

    public init(session: Session): void {
        this.session = session;
    }

    public isSelectionVisible(): boolean {
        const selected = this.getSelectedText();
        return selected !== undefined;
    }

    public async create(selection: ISelection): Promise<void> {
        function remember():
            | { anchorNode: Node; anchorOffset: number; focusNode: Node; focusOffset: number }
            | undefined {
            const winSel = window.getSelection();
            if (
                winSel === undefined ||
                winSel === null ||
                winSel.anchorNode === null ||
                winSel.focusNode === null
            ) {
                return undefined;
            }
            const reversed: boolean =
                winSel.anchorNode.compareDocumentPosition(winSel.focusNode) ===
                Node.DOCUMENT_POSITION_PRECEDING;
            return {
                anchorNode: reversed ? winSel.focusNode : winSel.anchorNode,
                anchorOffset: reversed ? winSel.focusOffset : winSel.anchorOffset,
                focusNode: reversed ? winSel.anchorNode : winSel.focusNode,
                focusOffset: reversed ? winSel.anchorOffset : winSel.focusOffset,
            };
        }
        function restore(stored: {
            anchorNode: Node;
            anchorOffset: number;
            focusNode: Node;
            focusOffset: number;
        }) {
            const winSel = window.getSelection();
            if (winSel === undefined || winSel === null) {
                return;
            }
            const range: Range = document.createRange();
            range.setStart(stored.anchorNode, stored.anchorOffset);
            range.setEnd(stored.focusNode, stored.focusOffset);
            winSel.removeAllRanges();
            winSel.addRange(range);
        }
        const uuid: string = unique();
        const selected = this.getSelectedText();
        if (selected === undefined) {
            throw new Error(`No selected text`);
        }
        const stored = remember();
        const origin = await this.session.stream.grab([
            { from: selection.rows.start, to: selection.rows.start },
            { from: selection.rows.end, to: selection.rows.end },
        ]);
        stored !== undefined && restore(stored);
        const comment: Definition | Error = (() => {
            if (selection.rows.start === selection.rows.end) {
                const sel: ActualSelectionData | Error = this.getActualSelectionData(
                    origin[0].content,
                    selected,
                    false,
                );
                if (sel instanceof Error) {
                    return sel;
                }
                return {
                    uuid,
                    state: CommentState.pending,
                    comment: '',
                    color: CShortColors[0],
                    created: Date.now(),
                    modified: Date.now(),
                    responses: [],
                    selection: {
                        start: {
                            position: Math.min(selection.rows.start, selection.rows.end),
                            offset: sel.start,
                            text: sel.selection,
                        },
                        end: {
                            position: Math.max(selection.rows.start, selection.rows.end),
                            offset: sel.end,
                            text: sel.selection,
                        },
                        text: selected,
                    },
                };
            } else {
                const rows = selected.split(/[\n\r]/gi);
                const stored = remember();
                if (stored === undefined) {
                    return new Error(`Fail save selection`);
                }
                if (rows.length < 2) {
                    return new Error(`Fail split rows correctly`);
                }
                const selStart: ActualSelectionData | Error = this.getActualSelectionData(
                    origin[0].content,
                    rows[0],
                    false,
                );
                restore(stored);
                const selEnd: ActualSelectionData | Error = this.getActualSelectionData(
                    origin[1].content,
                    rows[rows.length - 1],
                    true,
                );
                if (selStart instanceof Error) {
                    return selStart;
                }
                if (selEnd instanceof Error) {
                    return selEnd;
                }
                return {
                    uuid: uuid,
                    state: CommentState.pending,
                    comment: '',
                    color: CShortColors[0],
                    created: Date.now(),
                    modified: Date.now(),
                    responses: [],
                    selection: {
                        start: {
                            position: Math.min(selection.rows.start, selection.rows.end),
                            offset: selStart.start,
                            text: selStart.selection,
                        },
                        end: {
                            position: Math.max(selection.rows.start, selection.rows.end),
                            offset: selEnd.end,
                            text: selEnd.selection,
                        },
                        text: selected,
                    },
                };
            }
        })();
        if (comment instanceof Error) {
            throw comment;
        }
        const crossing: Definition[] = [];
        this.comments.forEach((com: Definition) => {
            if (
                com.selection.start.position === com.selection.end.position &&
                com.selection.start.position === comment.selection.start.position &&
                com.selection.end.position === comment.selection.end.position
            ) {
                if (
                    comment.selection.start.offset >= com.selection.start.offset &&
                    comment.selection.start.offset <= com.selection.end.offset
                ) {
                    crossing.push(com);
                } else if (
                    comment.selection.end.offset >= com.selection.start.offset &&
                    comment.selection.end.offset <= com.selection.end.offset
                ) {
                    crossing.push(com);
                } else if (
                    comment.selection.start.offset <= com.selection.start.offset &&
                    comment.selection.end.offset >= com.selection.end.offset
                ) {
                    crossing.push(com);
                }
            } else if (
                comment.selection.start.position >= com.selection.start.position &&
                comment.selection.start.position <= com.selection.end.position
            ) {
                crossing.push(com);
            } else if (
                comment.selection.end.position >= com.selection.start.position &&
                comment.selection.end.position <= com.selection.end.position
            ) {
                crossing.push(com);
            } else if (
                comment.selection.start.position <= com.selection.start.position &&
                comment.selection.end.position >= com.selection.end.position
            ) {
                crossing.push(com);
            }
        });
        const toBeStored: { comment: Definition; recover?: Definition } | undefined = (() => {
            if (crossing.length > 1) {
                // Here should be notification
                return;
            } else if (crossing.length === 1) {
                const recover = obj.clone(crossing[0]);
                if (
                    crossing[0].selection.start.position > comment.selection.start.position ||
                    (crossing[0].selection.start.position >= comment.selection.start.position &&
                        crossing[0].selection.start.offset > comment.selection.start.offset)
                ) {
                    crossing[0].selection.start = obj.clone(comment.selection.start);
                }
                if (
                    crossing[0].selection.end.position < comment.selection.end.position ||
                    (crossing[0].selection.end.position <= comment.selection.end.position &&
                        crossing[0].selection.end.offset < comment.selection.end.offset)
                ) {
                    crossing[0].selection.end = obj.clone(comment.selection.end);
                }
                crossing[0].state = CommentState.pending;
                return { comment: crossing[0], recover };
            } else {
                return { comment: comment };
            }
        })();
        if (toBeStored === undefined) {
            return;
        }
        this.comments.set(toBeStored.comment.uuid, toBeStored.comment);
        this.subjects.get().pending.emit(toBeStored.comment);
        this.edit(toBeStored.comment);
        return undefined;
    }

    public edit(comment: Definition) {
        const creating: boolean = comment.comment === '';
        comment.state = CommentState.pending;
        const popupHandle = popup.open({
            component: {
                factory: components.get('app-dialogs-comment'),
                inputs: {
                    comment: comment,
                    accept: (text: string) => {
                        comment.comment = text;
                        comment.state = CommentState.done;
                        comment.modified = Date.now();
                        this.comments.set(comment.uuid, comment);
                        if (creating) {
                            this.subjects.get().added.emit(comment);
                        } else {
                            this.subjects.get().updated.emit(comment);
                        }
                        this.session.switch().sidebar.comments();
                        this.session.highlights.subjects.get().update.emit();
                        popupHandle.close();
                    },
                    remove: () => {
                        this.remove(comment.uuid);
                        popupHandle.close();
                    },
                    cancel: () => {
                        popupHandle.close();
                    },
                },
            },
            position: {
                vertical: Vertical.top,
                horizontal: Horizontal.center,
            },
            closeOnKey: 'Escape',
            width: 450,
            uuid: 'add_new_comment',
        });
    }

    public remove(uuid: string) {
        this.comments.delete(uuid);
        this.subjects.get().removed.emit(uuid);
    }

    public update(comment: Definition) {
        if (!this.comments.has(comment.uuid)) {
            return;
        }
        comment.modified = Date.now();
        this.comments.set(comment.uuid, comment);
        this.subjects.get().updated.emit(comment);
    }

    public clear() {
        this.comments.forEach((comment: Definition, uuid: string) => {
            this.comments.delete(uuid);
            this.subjects.get().removed.emit(uuid);
        });
        this.comments.clear();
        this.session.highlights.subjects.get().update.emit();
    }

    public get(): Map<string, Definition> {
        return this.comments;
    }

    public getAsArray(): Definition[] {
        return Array.from(this.comments.values());
    }

    public isRowCommented(position: number) {
        try {
            this.comments.forEach((comment: Definition) => {
                if (position < comment.selection.start.position) {
                    return;
                }
                if (position > comment.selection.end.position) {
                    return;
                }
                throw true;
            });
        } catch (state) {
            return typeof state === 'boolean' ? state : false;
        }
        return false;
    }

    public getModifiers(position: number, str: string): Modifier[] {
        const comments: Definition[] = this.getRelevantComment(position);
        return comments.map((comment: Definition) => {
            return new CommentsModifier(comment, position, str);
        });
    }
}
export interface Comments extends LoggerInterface {}
