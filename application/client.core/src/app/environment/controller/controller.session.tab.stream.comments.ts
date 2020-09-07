import * as Toolkit from 'chipmunk.client.toolkit';
import { Observable, Subject } from 'rxjs';
import HotkeysService, { IHotkeyEvent } from '../services/service.hotkeys';
import { Subscription } from 'rxjs';
import { IScrollBoxSelection } from 'chipmunk-client-material';

export interface ISelectionPoint {
    position: number;
    offset: number;
}

export interface ICommentedSelection {
    start: ISelectionPoint;
    end: ISelectionPoint;
    text: string;
}

export interface IComment {
    guid: string;
    selection: ICommentedSelection;
}

export interface IActualSelectionData {
    selection: string;
    start: number;
    end: number;
}

export class ControllerSessionTabStreamComments {

    private _logger: Toolkit.Logger;
    private _sessionId: string;
    private _comments: Map<string, IComment> = new Map();
    private _subscriptions: { [key: string]: Toolkit.Subscription | Subscription } = {};

    private _subjects: {
        onAdded: Subject<IComment>,
        onRemoved: Subject<string>,
        onSelected: Subject<string>,
    } = {
        onAdded: new Subject<IComment>(),
        onRemoved: new Subject<string>(),
        onSelected: new Subject<string>()
    };

    constructor(session: string) {
        this._sessionId = session;
        this._logger = new Toolkit.Logger(`ControllerSessionComments: ${session}`);
    }

    public destroy() {
    }

    public create(selection: IScrollBoxSelection, startRowStr: string, endRowStr: string) {
        if (selection.anchor === selection.focus) {
            this._getActualSelectionData(startRowStr, selection.selection);
        }
        
        const guid: string = Toolkit.guid();
        this._comments.set(guid, {
            guid: guid,
            selection: {
                start: {
                    position: selection.anchor < selection.focus ? selection.anchor : selection.focus,
                    offset: selection.anchor < selection.focus ? selection.anchorOffset : selection.focusOffset,
                },
                end: {
                    position: selection.anchor > selection.focus ? selection.anchor : selection.focus,
                    offset: selection.anchor > selection.focus ? selection.anchorOffset : selection.focusOffset,
                },
                text: selection.selection,
            },
        });
    }

    public add(comment: IComment) {
    }

    public remove(guid: string) {
    }

    public getObservable(): {
        onAdded: Observable<IComment>,
        onRemoved: Observable<string>,
        onSelected: Observable<string>,
    } {
        return {
            onAdded: this._subjects.onAdded.asObservable(),
            onRemoved: this._subjects.onRemoved.asObservable(),
            onSelected: this._subjects.onSelected.asObservable()
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

    public getHTML(position: number, str: string): string {
        const comment: IComment | undefined = this._getRelevantComment(position);
        if (comment === undefined) {
            return str;
        }
        if (position === comment.selection.start.position && position === comment.selection.end.position) {
            const len: number = comment.selection.text.length;
            const from: number = comment.selection.end.offset - len;
            const to: number = comment.selection.end.offset;
            return str.substring(0, from) +
                '<span class="comment" style="background: red">' +
                str.substr(from, len) +
                '</span>' +
                str.substring(to, str.length);
        }
        if (position === comment.selection.start.position && position !== comment.selection.end.position) {
            return str;
        }
        if (position !== comment.selection.start.position && position === comment.selection.end.position) {
            return str;
        }
        if (position > comment.selection.start.position && position < comment.selection.end.position) {
            return `<span class="comment" style="background: red">${str}</span>`;
        }
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

    private _getActualSelectionData(original: string, selected: string): IActualSelectionData | Error {
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
                regStr += `(\\u001b\\[[\\d;]*[HfABCDsuJKmhIp])?${Toolkit.regTools.serializeRegStr(str[i])}`;
            }
            return new RegExp(regStr);
        }
        // Collapse selection to start. We need it because anchor and focus nodes can be in any order (depends
        // on how user did selection
        window.getSelection().collapseToStart();
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
            if (matchBefore === null || matchBefore.length === 0 || original.search(regBefore) !== 0) {
                return new Error(`Fail to catch begining of selection`);
            }
            selStartOffset = matchBefore[0].length;
            after = original.substring(selStartOffset, original.length);
        }
        const regAfter = getRegExpWithASCI(selected);
        const matchAfter = after.match(regAfter);
        if (matchAfter === null || matchAfter.length === 0 || after.search(regAfter) !== 0) {
            return new Error(`Fail to catch end of selection`);
        }
        const selEndOffset: number = matchAfter[0].length;
        const sel = { start: selStartOffset, end: selStartOffset + selEndOffset };
        return {
            selection: original.substring(sel.start, sel.end),
            start: selStartOffset,
            end: selEndOffset,
        };
    }
}
