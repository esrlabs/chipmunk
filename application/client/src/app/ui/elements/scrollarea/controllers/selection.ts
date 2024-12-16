import { Frame, ChangesInitiator } from './frame';
import { Subject, Subscription } from '@platform/env/subscription';
import {
    ROW_INDEX_ATTR,
    NodeInfo,
    RestorableNodeInfo,
    getFocusNodeInfo,
    getAnchorNodeInfo,
} from './selection.nodeinfo';
import { SelectionNode } from './selection.node';
import { Service } from './service';
import { escapeAnsi } from '@module/ansi';

import * as nums from '@platform/env/num';
import * as dom from '@ui/env/dom';

const DIRECTED_SCROLL_TIMEOUT_MS = 50;

export enum SelectionDirection {
    Top = 'Top',
    Bottom = 'Bottom',
}

export interface ISelection {
    rows: {
        start: number;
        end: number;
    };
    fragments: {
        start: string;
        end: string;
    };
}

export class Selecting {
    private _frame!: Frame;
    private _holder!: HTMLElement;
    private _service!: Service;
    private _progress: boolean = false;
    private _directed: {
        direction: SelectionDirection;
        timer: number;
    } = {
        direction: SelectionDirection.Bottom,
        timer: -1,
    };
    private _selection: {
        focus: NodeInfo;
        anchor: NodeInfo;
        start: string | undefined;
        end: string | undefined;
    } = {
        focus: getFocusNodeInfo(),
        anchor: getAnchorNodeInfo(),
        start: undefined,
        end: undefined,
    };
    private _subjects: {
        from: Subject<void>;
        finish: Subject<void>;
    } = {
        from: new Subject(),
        finish: new Subject(),
    };
    private _delimiter: string | undefined;

    protected copyRows(rows: string[]): void {
        const delimiter = this._delimiter;
        if (rows.length === 0) {
            return;
        }
        if (delimiter === undefined) {
            navigator.clipboard.writeText(rows.join('\n'));
        } else {
            const columns = rows.map((r) => r.split(delimiter));
            const widths = new Array(columns[0].length);
            columns.forEach((rows: string[]) => {
                rows.forEach((r, i) => {
                    if (widths[i] === undefined) {
                        widths[i] = 0;
                    }
                    widths[i] = Math.max(widths[i], r.length);
                });
            });
            const formated = columns.map((rows: string[]) => {
                return rows
                    .map((r, i) => {
                        const repeat = nums.diffUInts([widths[i], r.length], 0);
                        return `${r}${' '.repeat(repeat < 0 ? 0 : repeat)}`;
                    })
                    .join(' | ');
            });
            navigator.clipboard.writeText(formated.join('\n'));
        }
    }

    public bind(holder: HTMLElement, frame: Frame, service: Service) {
        this._holder = holder;
        this._frame = frame;
        this._service = service;
    }

    public destroy() {}

    public isInProgress(): boolean {
        return this._progress;
    }

    public restore() {
        const getMaxOffset = (node: Node): number => {
            if (node.nodeType === Node.TEXT_NODE) {
                return node.textContent === null ? 0 : node.textContent.length - 1;
            } else if (node.childNodes.length > 0) {
                return node.childNodes.length;
            } else {
                return 0;
            }
        };
        if (!this.hasSelection()) {
            return;
        }
        const frame = this._frame.get();
        const focus: RestorableNodeInfo | undefined = this._selection.focus.get();
        const anchor: RestorableNodeInfo | undefined = this._selection.anchor.get();
        const selection: Selection | null = document.getSelection();
        if (!focus || !anchor) {
            return;
        }
        if (
            (focus.row < frame.start && anchor.row < frame.start) ||
            (focus.row > frame.end && anchor.row > frame.end)
        ) {
            if (selection !== null) {
                selection.removeAllRanges();
            }
            return;
        }
        let anchorOffset: number = -1;
        let focusOffset: number = -1;
        let anchorPath: string = '';
        let focusPath: string = '';
        if (focus.row === anchor.row) {
            anchorOffset = anchor.offset;
            focusOffset = focus.offset;
            anchorPath = anchor.path;
            focusPath = focus.path;
        } else if (focus.row > anchor.row) {
            // Direction: down
            anchorOffset = anchor.row < frame.start ? 0 : anchor.offset;
            focusOffset = focus.row > frame.end ? Infinity : focus.offset;
            anchorPath =
                anchor.row < frame.start ? `li[${ROW_INDEX_ATTR}="${frame.start}"]` : anchor.path;
            focusPath = focus.row > frame.end ? `li[${ROW_INDEX_ATTR}="${frame.end}"]` : focus.path;
        } else if (focus.row < anchor.row) {
            // Direction: up
            anchorOffset = anchor.row > frame.end ? Infinity : anchor.offset;
            focusOffset = focus.row < frame.start ? 0 : focus.offset;
            anchorPath =
                anchor.row > frame.end ? `li[${ROW_INDEX_ATTR}="${frame.end}"]` : anchor.path;
            focusPath =
                focus.row < frame.start ? `li[${ROW_INDEX_ATTR}="${frame.start}"]` : focus.path;
        }
        if (selection === null) {
            return;
        }
        selection.removeAllRanges();
        const anchorNode: Node | null = SelectionNode.select(this._holder, anchorPath);
        const focusNode: Node | null = SelectionNode.select(this._holder, focusPath);
        if (anchorNode === null || focusNode === null) {
            return;
        }
        if (
            !isFinite(anchorOffset) ||
            (typeof anchorNode.textContent === 'string' &&
                anchorNode.textContent.length <= anchorOffset)
        ) {
            anchorOffset = getMaxOffset(anchorNode);
        }
        if (
            !isFinite(focusOffset) ||
            (typeof focusNode.textContent === 'string' &&
                focusNode.textContent.length <= focusOffset)
        ) {
            focusOffset = getMaxOffset(focusNode);
        }
        try {
            selection.setBaseAndExtent(anchorNode, anchorOffset, focusNode, focusOffset);
        } catch (e) {
            let details: string = 'Error with restoring selection:';
            details += `\n\t-\tanchorPath: ${anchorPath}`;
            details += `\n\t-\tfocusNode: ${focusPath}`;
            if (typeof anchorNode.textContent === 'string') {
                details += `\n\t-\t${
                    anchorNode.textContent.length <= anchorOffset ? '[WRONG]' : ''
                }anchor (${anchorNode.nodeName}): "${anchorNode.textContent}" (${
                    anchorNode.textContent.length
                }): ${anchorOffset}`;
            }
            if (typeof focusNode.textContent === 'string') {
                details += `\n\t-\t${
                    focusNode.textContent.length <= focusOffset ? '[WRONG]' : ''
                }focus (${focusNode.nodeName}): "${focusNode.textContent}" (${
                    focusNode.textContent.length
                }): ${focusOffset}`;
            }
            details += `\n\t-\terror: ${e instanceof Error ? e.message : e}`;
            console.warn(details);
        }
    }

    public onSelectionStart(handler: () => void): Subscription {
        return this._subjects.from.subscribe(handler);
    }

    public onSelectionFinish(handler: () => void): Subscription {
        return this._subjects.finish.subscribe(handler);
    }

    public directed(): {
        start(direction: SelectionDirection): void;
        next(): void;
        finish(): void;
    } {
        return {
            start: (direction: SelectionDirection): void => {
                if (!this._progress) {
                    return;
                }
                this._directed.direction = direction;
                this.directed().next();
            },
            next: (): void => {
                if (!this._progress) {
                    return;
                }
                clearTimeout(this._directed.timer);
                switch (this._directed.direction) {
                    case SelectionDirection.Top:
                        this._frame.offsetToByRows(-1, ChangesInitiator.Selecting);
                        this._selection.focus.setToRow(this._frame.get().start);
                        break;
                    case SelectionDirection.Bottom:
                        this._frame.offsetToByRows(1, ChangesInitiator.Selecting);
                        this._selection.focus.setToRow(this._frame.get().end);
                        break;
                }
                this._holder.focus();
                this._directed.timer = setTimeout(() => {
                    this.directed().next();
                }, DIRECTED_SCROLL_TIMEOUT_MS) as any;
            },
            finish: (): void => {
                clearTimeout(this._directed.timer);
                this._directed.timer = -1;
            },
        };
    }

    public get(): ISelection | string | undefined {
        if (this._selection.focus.row === undefined || this._selection.anchor.row === undefined) {
            return undefined;
        }
        if (this._selection.focus.row === this._selection.anchor.row) {
            const selection = document.getSelection();
            const output = selection === null ? undefined : selection.toString();
            return output === null ? undefined : output === '' ? undefined : output;
        }
        if (this._selection.start === undefined || this._selection.end === undefined) {
            return undefined;
        }
        const rows = {
            start: Math.min(this._selection.focus.row, this._selection.anchor.row),
            end: Math.max(this._selection.focus.row, this._selection.anchor.row),
        };
        const fragments = {
            start: this._selection.start,
            end: this._selection.end,
        };
        if (fragments.start !== fragments.end) {
            fragments.start === '' && (rows.start += 1);
            fragments.end === '' && (rows.end -= 1);
        }
        return {
            rows,
            fragments,
        };
    }

    public getAsSelection(): ISelection | undefined {
        if (this._selection.focus.row === undefined || this._selection.anchor.row === undefined) {
            return undefined;
        }
        const selection: Selection | null = document.getSelection();
        if (
            (this._selection.start === undefined || this._selection.end === undefined) &&
            selection !== null
        ) {
            this._selection.start = selection.toString();
            this._selection.end = selection.toString();
        }
        if (this._selection.start === undefined || this._selection.end === undefined) {
            return undefined;
        }
        const rows = {
            start: Math.min(this._selection.focus.row, this._selection.anchor.row),
            end: Math.max(this._selection.focus.row, this._selection.anchor.row),
        };
        const fragments = {
            start: this._selection.start,
            end: this._selection.end,
        };
        if (fragments.start !== fragments.end) {
            fragments.start === '' && (rows.start += 1);
            fragments.end === '' && (rows.end -= 1);
        }
        return {
            rows,
            fragments,
        };
    }

    public selection(): { exist: boolean; lines: number } {
        const selection = this.get();
        if (selection === undefined) {
            return {
                exist: false,
                lines: 0,
            };
        } else {
            const len =
                typeof selection === 'string' ? 1 : selection.rows.end - selection.rows.start + 1;
            return {
                exist: selection !== undefined,
                lines: len < 0 ? 0 : len,
            };
        }
    }

    public async copyToClipboard(): Promise<void> {
        const selection = this.get();
        if (selection === undefined) {
            return Promise.resolve();
        }
        if (typeof selection === 'string') {
            navigator.clipboard.writeText(selection);
            return Promise.resolve();
        }
        const rows = (
            await this._service.getRows({ start: selection.rows.start, end: selection.rows.end })
        ).rows.map((r) => {
            if (this._delimiter === undefined) {
                const escaped = escapeAnsi(r.content);
                return escaped instanceof Error ? r.content : escaped;
            } else {
                return r.content;
            }
        });
        if (rows.length === 0) {
            return Promise.resolve();
        }
        if (rows.length > 1 && this._delimiter === undefined) {
            selection.fragments.start !== '' && (rows[0] = selection.fragments.start);
            selection.fragments.end !== '' && (rows[rows.length - 1] = selection.fragments.end);
        }
        this.copyRows(rows);
    }

    public setDelimiter(delimiter: string | undefined): void {
        this._delimiter = delimiter;
    }

    public drop() {
        this._selection = {
            focus: getFocusNodeInfo(),
            anchor: getAnchorNodeInfo(),
            start: undefined,
            end: undefined,
        };
        const selection: Selection | null = document.getSelection();
        selection && selection.removeAllRanges();
    }

    public hasSelection(): boolean {
        return this._selection.focus !== undefined || this._selection.anchor !== undefined;
    }

    public start(event: MouseEvent) {
        if (event.button !== undefined && event.button !== 0) {
            // Context menu call
            return;
        }
        this.drop();
        this._progress = true;
        this._holder.focus();
        this._subjects.from.emit();
    }

    public change() {
        if (!this._progress) {
            return;
        }
        const selection: Selection | null = document.getSelection();
        if (selection === null) {
            return;
        }
        this._selection.focus.update(selection);
        this._selection.anchor.update(selection);
        this._detectBorders(selection);
    }

    public end(event: MouseEvent) {
        if (event.button !== undefined && event.button !== 0) {
            // Context menu call
            return;
        }
        if (!this._progress) {
            if (!this._isOwnSelection()) {
                this._selection = {
                    focus: getFocusNodeInfo(),
                    anchor: getAnchorNodeInfo(),
                    start: undefined,
                    end: undefined,
                };
            }
            return;
        }
        this._progress = false;
        this._subjects.finish.emit();
    }

    public check(event: MouseEvent) {
        if (!dom.findParentByTag(event.target as HTMLElement, ['app-scrollarea'])) {
            return this.drop();
        }
        if (!dom.isParent(event.target as HTMLElement, this._holder)) {
            return;
        }
        setTimeout(() => {
            if (this._progress) {
                return;
            }
            if (!this.hasSelection()) {
                return;
            }
            this.restore();
        }, 10);
    }

    private _detectBorders(selection: Selection): void {
        const asText = selection.toString().split(/[\n\r]/gi);
        if (
            this._selection.focus.row !== undefined &&
            this._selection.anchor.row !== undefined &&
            asText.length > 0
        ) {
            if (this._selection.focus.row > this._selection.anchor.row) {
                this._selection.end = asText[asText.length - 1];
                if (this._selection.start === undefined) {
                    this._selection.start = asText[0];
                }
            } else if (this._selection.focus.row < this._selection.anchor.row) {
                this._selection.start = asText[0];
                if (this._selection.end === undefined) {
                    this._selection.end = asText[asText.length - 1];
                }
            } else if (this._selection.focus.row === this._selection.anchor.row) {
                this._selection.start = undefined;
                this._selection.end = undefined;
            }
        }
    }

    private _isOwnSelection(): boolean {
        const selection: Selection | null = document.getSelection();
        if (selection === null) {
            return false;
        }
        for (let i = 0; i < selection.rangeCount; i += 1) {
            try {
                if (
                    !dom.isParentOf(selection.getRangeAt(i).commonAncestorContainer, this._holder)
                ) {
                    return false;
                }
            } catch (_e) {
                return false;
            }
        }
        return true;
    }
}
