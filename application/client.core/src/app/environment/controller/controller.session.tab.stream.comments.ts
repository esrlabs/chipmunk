import * as Toolkit from 'chipmunk.client.toolkit';

import { Observable, Subject } from 'rxjs';
import { Subscription } from 'rxjs';
import { IScrollBoxSelection } from 'chipmunk-client-material';
import { Modifier } from 'chipmunk.client.toolkit';
import { CommentSelectionModifier } from './controller.session.tab.stream.comments.modifier';
import { IComment, IActualSelectionData, ECommentState } from './controller.session.tab.stream.comments.types';
import { DialogsAddCommentOnRowComponent } from '../components/dialogs/comment.row.add/component';
import { IAPI } from 'chipmunk.client.toolkit';

import LayoutStateService from '../services/standalone/service.layout.state';
import PopupsService from '../services/standalone/service.popups';
import OutputParsersService from '../services/standalone/service.output.parsers';

export class ControllerSessionTabStreamComments {

    private _logger: Toolkit.Logger;
    private _sessionId: string;
    private _comments: Map<string, IComment> = new Map();
    private _subscriptions: { [key: string]: Toolkit.Subscription | Subscription } = {};
    private _api: IAPI;

    private _subjects: {
        onAdded: Subject<IComment>,
        onUpdated: Subject<IComment>,
        onPending: Subject<IComment>,
        onRemoved: Subject<string>,
        onSelected: Subject<string>,
    } = {
        onAdded: new Subject<IComment>(),
        onUpdated: new Subject<IComment>(),
        onPending: new Subject<IComment>(),
        onRemoved: new Subject<string>(),
        onSelected: new Subject<string>()
    };

    constructor(session: string, api: IAPI) {
        this._api = api;
        this._sessionId = session;
        this._logger = new Toolkit.Logger(`ControllerSessionComments: ${session}`);
    }

    public destroy() {
    }

    public create(selection: IScrollBoxSelection, startRowStr: string, endRowStr: string): Error | undefined {
        function remember(): { anchorNode: Node, anchorOffset: number, focusNode: Node, focusOffset: number } | undefined {
            const winSel = window.getSelection();
            if (winSel === undefined) {
                return undefined;
            }
            return {
                anchorNode: winSel.anchorNode,
                anchorOffset: winSel.anchorOffset,
                focusNode: winSel.focusNode,
                focusOffset: winSel.focusOffset,
            };
        }
        function restore(stored: { anchorNode: Node, anchorOffset: number, focusNode: Node, focusOffset: number }) {
            const winSel = window.getSelection();
            if (winSel === undefined) {
                return;
            }
            const range: Range = document.createRange();
            range.setStart(stored.anchorNode, stored.anchorOffset);
            range.setEnd(stored.focusNode, stored.focusOffset);
            winSel.removeAllRanges();
            winSel.addRange(range);
        }
        const guid: string = Toolkit.guid();
        let comment;
        if (selection.anchor === selection.focus) {
            const sel: IActualSelectionData | Error = this._getActualSelectionData(startRowStr, selection.selection, false);
            if (sel instanceof Error) {
                return sel;
            }
            comment = {
                guid: guid,
                state: ECommentState.pending,
                comment: '',
                selection: {
                    start: {
                        position: selection.anchor,
                        offset: sel.start,
                        text: sel.selection,
                    },
                    end: {
                        position: selection.anchor,
                        offset: sel.end,
                        text: sel.selection,
                    },
                    text: selection.selection,
                },
            };
        } else {
            const rows = selection.selection.split(/[\n\r]/gi);
            const stored = remember();
            if (stored === undefined) {
                return new Error(`Fail save selection`);
            }
            if (rows.length < 2) {
                return new Error(`Fail split rows correctly`);
            }
            const selStart: IActualSelectionData | Error = this._getActualSelectionData(startRowStr, rows[0], false);
            restore(stored);
            const selEnd: IActualSelectionData | Error = this._getActualSelectionData(endRowStr, rows[rows.length - 1], true);
            if (selStart instanceof Error) {
                return selStart;
            }
            if (selEnd instanceof Error) {
                return selEnd;
            }
            comment = {
                guid: guid,
                state: ECommentState.pending,
                comment: '',
                selection: {
                    start: {
                        position: selection.anchor,
                        offset: selStart.start,
                        text: selStart.selection,
                    },
                    end: {
                        position: selection.focus,
                        offset: selEnd.end,
                        text: selEnd.selection,
                    },
                    text: selection.selection,
                },
            };
        }
        this._comments.set(guid, comment);
        OutputParsersService.updateRowsView();
        this._subjects.onPending.next(comment);
        this.edit(comment, true);
    }

    public edit(comment: IComment, creating: boolean = false) {
        comment.state = ECommentState.pending;
        const guid: string = PopupsService.add({
            id: 'commend-add-on-row-dialog',
            options: {
                closable: false,
                width: 40,
            },
            caption: `Add new comment`,
            component: {
                factory: DialogsAddCommentOnRowComponent,
                inputs: {
                    comment: comment,
                    accept: (text: string) => {
                        PopupsService.remove(guid);
                        comment.comment = text;
                        comment.state = ECommentState.done;
                        this._comments.set(comment.guid, comment);
                        if (creating) {
                            this._subjects.onAdded.next(comment);
                        } else {
                            this._subjects.onUpdated.next(comment);
                        }
                        this._api.openSidebarApp('comments', false);
                        LayoutStateService.sidebarMax();
                    },
                    remove: () => {
                        PopupsService.remove(guid);
                        this.remove(comment.guid);
                    },
                    cancel: () => {
                        PopupsService.remove(guid);
                        if (creating) {
                            this._comments.delete(comment.guid);
                        }
                        OutputParsersService.updateRowsView();
                    }
                }
            }
        });
    }

    public remove(guid: string) {
        this._comments.delete(guid);
        OutputParsersService.updateRowsView();
        this._subjects.onRemoved.next(guid);
    }

    public getObservable(): {
        onAdded: Observable<IComment>,
        onUpdated: Observable<IComment>,
        onPending: Observable<IComment>,
        onRemoved: Observable<string>,
        onSelected: Observable<string>,
    } {
        return {
            onAdded: this._subjects.onAdded.asObservable(),
            onUpdated: this._subjects.onUpdated.asObservable(),
            onPending: this._subjects.onPending.asObservable(),
            onRemoved: this._subjects.onRemoved.asObservable(),
            onSelected: this._subjects.onSelected.asObservable(),
        };
    }

    public get(): Map<string, IComment> {
        return this._comments;
    }

    public isRowCommented(position: number) {
        try {
            this._comments.forEach((comment: IComment) => {
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

    public getModifier(position: number, str: string): Modifier {
        const comment: IComment | undefined = this._getRelevantComment(position);
        return new CommentSelectionModifier(comment, position, str);
    }

    private _getRelevantComment(position: number): IComment | undefined {
        try {
            this._comments.forEach((comment: IComment) => {
                if (position < comment.selection.start.position) {
                    return;
                }
                if (position > comment.selection.end.position) {
                    return;
                }
                throw comment;
            });
        } catch (comment) {
            return comment;
        }
        return undefined;
    }

    private _getActualSelectionData(original: string, selected: string, readFromEnd: boolean): IActualSelectionData | Error {
        function getHolder(node: HTMLElement): HTMLElement | Error {
            if (node.nodeName.toLowerCase().search('app-views-output-row-') !== -1) {
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
                regStr += `[\\u0000-\\u001f]?(\\u001b\\[[\\d;]*[HfABCDsuJKmhIp])?${Toolkit.regTools.serializeRegStr(str[i])}`;
                //         all notprintalbe | possible ASCII codes               | single char, which we are looking for
                //         symbols          |                                    |
            }
            return new RegExp(regStr);
        }
        // Collapse selection to start. We need it because anchor and focus nodes can be in any order (depends
        // on how user did selection
        if (!readFromEnd) {
            window.getSelection().collapseToStart();
        } else {
            window.getSelection().collapseToEnd();
        }
        const selection = window.getSelection();
        if (selection === undefined) {
            return new Error(`No active selection`);
        }
        const anchorNode = selection.anchorNode;
        const anchorOffset = selection.anchorOffset;
        // Looking for root row node
        const holder: HTMLElement | Error = getHolder(selection.anchorNode as HTMLElement);
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
            if (matchBefore === null || matchBefore.length === 0 || original.search(regBefore) === -1) {
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

}
