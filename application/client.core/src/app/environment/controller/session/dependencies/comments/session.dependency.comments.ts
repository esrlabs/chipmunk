import * as Toolkit from 'chipmunk.client.toolkit';

import { Observable, Subject } from 'rxjs';
import { Subscription } from 'rxjs';
import { IScrollBoxSelection } from 'chipmunk-client-material';
import { Modifier } from 'chipmunk.client.toolkit';
import { CommentSelectionModifier } from './session.dependency.comments.modifier';
import { IComment, IActualSelectionData, ECommentState } from './session.dependency.comments.types';
import { DialogsAddCommentOnRowComponent } from '../../../../components/dialogs/comment.row.add/component';
import { CShortColors } from '../../../../conts/colors';
import { Importable } from '../importer/controller.session.importer.interface';
import { Dependency, SessionGetter } from '../session.dependency';

import LayoutStateService from '../../../../services/standalone/service.layout.state';
import PopupsService from '../../../../services/standalone/service.popups';
import OutputParsersService from '../../../../services/standalone/service.output.parsers';

export class ControllerSessionTabStreamComments
    extends Importable<IComment[]>
    implements Dependency
{
    private _logger: Toolkit.Logger;
    private _sessionId: string;
    private _comments: Map<string, IComment> = new Map();
    private _subscriptions: { [key: string]: Toolkit.Subscription | Subscription } = {};

    private _subjects: {
        onAdded: Subject<IComment>;
        onUpdated: Subject<IComment>;
        onPending: Subject<IComment>;
        onRemoved: Subject<string>;
        onSelected: Subject<string>;
        onExport: Subject<void>;
    } = {
        onAdded: new Subject<IComment>(),
        onUpdated: new Subject<IComment>(),
        onPending: new Subject<IComment>(),
        onRemoved: new Subject<string>(),
        onSelected: new Subject<string>(),
        onExport: new Subject<void>(),
    };
    private _session: SessionGetter;

    constructor(uuid: string, getter: SessionGetter) {
        super();
        this._session = getter;
        this._sessionId = uuid;
        this._logger = new Toolkit.Logger(`ControllerSessionComments: ${uuid}`);
    }

    public destroy(): Promise<void> {
        return new Promise((resolve, reject) => {
            this._comments.clear();
            resolve();
        });
    }

    public init(): Promise<void> {
        return new Promise((resolve, reject) => {
            resolve();
        });
    }

    public getName(): string {
        return 'ControllerSessionTabStreamComments';
    }

    public isSelectionVisible(selection: IScrollBoxSelection): boolean {
        const visibleSel = window.getSelection();
        if (visibleSel === undefined || visibleSel === null) {
            return false;
        }
        return visibleSel.toString() === selection.original;
    }

    public create(
        selection: IScrollBoxSelection,
        startRowStr: string,
        endRowStr: string,
    ): Error | undefined {
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
        const guid: string = Toolkit.guid();
        const comment: IComment | Error = (() => {
            if (selection.anchor === selection.focus) {
                const sel: IActualSelectionData | Error = this._getActualSelectionData(
                    startRowStr,
                    selection.original,
                    false,
                );
                if (sel instanceof Error) {
                    return sel;
                }
                return {
                    guid: guid,
                    state: ECommentState.pending,
                    comment: '',
                    color: CShortColors[0],
                    created: Date.now(),
                    modified: Date.now(),
                    responses: [],
                    selection: {
                        start: {
                            position: Math.min(selection.anchor, selection.focus),
                            offset: sel.start,
                            text: sel.selection,
                        },
                        end: {
                            position: Math.max(selection.anchor, selection.focus),
                            offset: sel.end,
                            text: sel.selection,
                        },
                        text: selection.original,
                    },
                };
            } else {
                if (!this.isSelectionVisible(selection)) {
                    return new Error(`No visible selection`);
                }
                const rows = selection.original.split(/[\n\r]/gi);
                const stored = remember();
                if (stored === undefined) {
                    return new Error(`Fail save selection`);
                }
                if (rows.length < 2) {
                    return new Error(`Fail split rows correctly`);
                }
                const selStart: IActualSelectionData | Error = this._getActualSelectionData(
                    startRowStr,
                    rows[0],
                    false,
                );
                restore(stored);
                const selEnd: IActualSelectionData | Error = this._getActualSelectionData(
                    endRowStr,
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
                    guid: guid,
                    state: ECommentState.pending,
                    comment: '',
                    color: CShortColors[0],
                    created: Date.now(),
                    modified: Date.now(),
                    responses: [],
                    selection: {
                        start: {
                            position: Math.min(selection.anchor, selection.focus),
                            offset: selStart.start,
                            text: selStart.selection,
                        },
                        end: {
                            position: Math.max(selection.anchor, selection.focus),
                            offset: selEnd.end,
                            text: selEnd.selection,
                        },
                        text: selection.original,
                    },
                };
            }
        })();
        if (comment instanceof Error) {
            return comment;
        }
        const crossing: IComment[] = [];
        this._comments.forEach((com: IComment) => {
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
        const toBeStored: { comment: IComment; recover?: IComment } | undefined = (() => {
            if (crossing.length > 1) {
                // Here should be notification
                return;
            } else if (crossing.length === 1) {
                const recover = Toolkit.copy(crossing[0]);
                if (
                    crossing[0].selection.start.position > comment.selection.start.position ||
                    (crossing[0].selection.start.position >= comment.selection.start.position &&
                        crossing[0].selection.start.offset > comment.selection.start.offset)
                ) {
                    crossing[0].selection.start = Toolkit.copy(comment.selection.start);
                }
                if (
                    crossing[0].selection.end.position < comment.selection.end.position ||
                    (crossing[0].selection.end.position <= comment.selection.end.position &&
                        crossing[0].selection.end.offset < comment.selection.end.offset)
                ) {
                    crossing[0].selection.end = Toolkit.copy(comment.selection.end);
                }
                crossing[0].state = ECommentState.pending;
                return { comment: crossing[0], recover: recover };
            } else {
                return { comment: comment };
            }
        })();
        if (toBeStored === undefined) {
            return;
        }
        this._comments.set(toBeStored.comment.guid, toBeStored.comment);
        this._subjects.onPending.next(toBeStored.comment);
        this.edit(toBeStored.comment, toBeStored.recover);
        OutputParsersService.updateRowsView();
        return undefined;
    }

    public edit(comment: IComment, recover?: IComment) {
        const creating: boolean = comment.comment === '';
        const cancel = (id: string) => {
            PopupsService.remove(id);
            if (creating) {
                this._comments.delete(comment.guid);
            }
            if (recover !== undefined) {
                this._comments.set(recover.guid, recover);
            }
            OutputParsersService.updateRowsView();
        };
        let anyActionCalled: boolean = false;
        comment.state = ECommentState.pending;
        const guid: string | undefined = PopupsService.add({
            id: 'commend-add-on-row-dialog',
            options: {
                closable: false,
                width: 40,
            },
            caption: `Add new comment`,
            beforeClose: () => {
                if (anyActionCalled) {
                    return;
                }
                guid !== undefined && cancel(guid);
            },
            component: {
                factory: DialogsAddCommentOnRowComponent,
                inputs: {
                    comment: comment,
                    accept: (text: string) => {
                        anyActionCalled = true;
                        guid !== undefined && PopupsService.remove(guid);
                        comment.comment = text;
                        comment.state = ECommentState.done;
                        comment.modified = Date.now();
                        this._comments.set(comment.guid, comment);
                        if (creating) {
                            this._subjects.onAdded.next(comment);
                            this._subjects.onExport.next();
                        } else {
                            this._subjects.onUpdated.next(comment);
                            this._subjects.onExport.next();
                        }
                        this._session().getAPI().openSidebarApp('comments', false);
                        LayoutStateService.sidebarMax();
                    },
                    remove: () => {
                        anyActionCalled = true;
                        guid !== undefined && PopupsService.remove(guid);
                        this.remove(comment.guid);
                    },
                    cancel: () => {
                        anyActionCalled = true;
                        guid !== undefined && cancel(guid);
                    },
                },
            },
        });
    }

    public remove(guid: string) {
        this._comments.delete(guid);
        OutputParsersService.updateRowsView();
        this._subjects.onRemoved.next(guid);
        this._subjects.onExport.next();
    }

    public update(comment: IComment) {
        if (!this._comments.has(comment.guid)) {
            return;
        }
        comment.modified = Date.now();
        this._comments.set(comment.guid, comment);
        this._subjects.onUpdated.next(comment);
        this._subjects.onExport.next();
    }

    public clear() {
        this._comments.forEach((comment: IComment, guid: string) => {
            this._comments.delete(guid);
            this._subjects.onRemoved.next(guid);
        });
        this._comments.clear();
        OutputParsersService.updateRowsView();
        this._subjects.onExport.next();
    }

    public getObservable(): {
        onAdded: Observable<IComment>;
        onUpdated: Observable<IComment>;
        onPending: Observable<IComment>;
        onRemoved: Observable<string>;
        onSelected: Observable<string>;
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

    public getModifiers(position: number, str: string): Modifier[] {
        const comments: IComment[] = this._getRelevantComment(position);
        return comments.map((comment: IComment) => {
            return new CommentSelectionModifier(comment, position, str);
        });
    }

    public getExportObservable(): Observable<void> {
        return this._subjects.onExport.asObservable();
    }

    public getImporterUUID(): string {
        return 'comments';
    }

    public export(): Promise<IComment[] | undefined> {
        return new Promise((resolve) => {
            if (this._comments.size === 0) {
                return resolve(undefined);
            }
            resolve(Array.from(this._comments.values()));
        });
    }

    public import(comments: IComment[]): Promise<void> {
        return new Promise((resolve, reject) => {
            this._comments.clear();
            comments.forEach((comment: IComment) => {
                this._comments.set(comment.guid, comment);
                this._subjects.onAdded.next(comment);
                this._subjects.onExport.next();
            });
            OutputParsersService.updateRowsView();
            this._session().getAPI().openSidebarApp('comments', true);
            resolve();
        });
    }

    private _getRelevantComment(position: number): IComment[] {
        const comments: IComment[] = [];
        this._comments.forEach((comment: IComment) => {
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

    private _getActualSelectionData(
        original: string,
        selected: string,
        readFromEnd: boolean,
    ): IActualSelectionData | Error {
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
                regStr += `[\\u0000-\\u001f]?(\\u001b\\[[\\d;]*[HfABCDsuJKmhIp])?${Toolkit.regTools.serializeRegStr(
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
}
