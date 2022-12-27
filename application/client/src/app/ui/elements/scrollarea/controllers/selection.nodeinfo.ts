import { SelectionNode } from './selection.node';

export const ROW_INDEX_ATTR: string = 'data-row-index';
export const ROOT_ROW_NODE: string = 'li';

export enum Target {
    Focus = 0,
    Anchor = 1,
}

export interface IRowNodeInfo {
    path: string;
    index: number;
}

export interface RestorableNodeInfo {
    row: number;
    path: string;
    offset: number;
    node: SelectionNode;
}

export class NodeInfo {
    public row: number | undefined;
    public path: string | undefined;
    public offset: number | undefined;
    public node: SelectionNode = new SelectionNode();
    private _target: Target;

    constructor(target: Target) {
        this._target = target;
    }

    public get(): RestorableNodeInfo | undefined {
        if (
            this.row === undefined ||
            this.path === undefined ||
            this.offset === undefined ||
            this.node === null
        ) {
            return undefined;
        } else {
            return {
                row: this.row,
                path: this.path,
                offset: this.offset,
                node: this.node,
            };
        }
    }

    public update(selection: Selection) {
        if (this._target === Target.Anchor && this.row !== undefined) {
            return;
        }
        const accessor = this._getAccessor(selection);
        if (accessor.node()?.nodeType === Node.COMMENT_NODE) {
            return;
        }
        if (this.node.get() !== accessor.node()) {
            const rowInfo: IRowNodeInfo | undefined = this._getRowInfo(accessor.node());
            if (rowInfo === undefined) {
                this.node.set(null);
                return;
            }
            this.path = rowInfo.path;
            this.row = rowInfo.index;
            this.node.set(accessor.node());
            this.offset = accessor.offset();
        } else {
            this.offset = accessor.offset();
        }
        if (this._target === Target.Anchor && this.row === undefined) {
            console.log(`${this.path} / ${this.row} / ${this.offset}`);
        }
    }

    public setToRow(rowIndex: number) {
        this.path = `${ROOT_ROW_NODE}[${ROW_INDEX_ATTR}="${rowIndex}"]`;
        this.row = rowIndex;
        this.offset = 0;
        this.node.set(null);
    }

    private _getRowInfo(node: Node | null, path: string = ''): IRowNodeInfo | undefined {
        if (node === null) {
            return undefined;
        }
        if (node.parentNode === undefined || node.parentNode === null) {
            return undefined;
        }
        if (node.nodeName.toLowerCase() === 'body') {
            return undefined;
        }
        const rowIndex: number | undefined = this._getIndexAttr(node);
        if (rowIndex !== undefined) {
            return {
                index: rowIndex,
                path: `${node.nodeName.toLowerCase()}[${ROW_INDEX_ATTR}="${rowIndex}"]${
                    path !== '' ? ' ' : ''
                }${path}`,
            };
        } else if (node.nodeType === Node.TEXT_NODE) {
            const textNodeIndex: number = this._getTextNodeIndex(node);
            return textNodeIndex === -1
                ? undefined
                : this._getRowInfo(node.parentNode as HTMLElement, `#text:${textNodeIndex}`);
        } else if (node.parentNode.children.length !== 0 && rowIndex === undefined) {
            const childIndex: number = this._getChildIndex(node);
            return childIndex === -1
                ? undefined
                : this._getRowInfo(
                      node.parentNode,
                      `${node.nodeName.toLowerCase()}:nth-child(${childIndex + 1})${
                          path !== '' ? ' ' : ''
                      }${path}`,
                  );
        } else {
            return this._getRowInfo(
                node.parentNode as HTMLElement,
                `${node.nodeName.toLowerCase()}${path !== '' ? ' ' : ''}${path}`,
            );
        }
    }

    private _getAccessor(selection: Selection): {
        node(): Node | null;
        offset(): number;
    } {
        const self = this;
        return {
            node(): Node | null {
                return self._target === Target.Focus ? selection.focusNode : selection.anchorNode;
            },
            offset(): number {
                return self._target === Target.Focus
                    ? selection.focusOffset
                    : selection.anchorOffset;
            },
        };
    }

    private _getIndexAttr(node: Node): number | undefined {
        if (typeof (node as HTMLElement).getAttribute !== 'function') {
            return undefined;
        }
        const attr: string | null = (node as HTMLElement).getAttribute(ROW_INDEX_ATTR);
        if (attr === null || attr.trim().length === 0) {
            return undefined;
        }
        const index = parseInt(attr, 10);
        if (isNaN(index) || !isFinite(index)) {
            return undefined;
        }
        return index;
    }

    private _getTextNodeIndex(node: Node): number {
        if (node.parentNode === null) {
            return -1;
        }
        let index: number = -1;
        try {
            Array.prototype.forEach.call(node.parentNode.childNodes, (child: Node, i: number) => {
                if (node === child) {
                    index = i;
                    throw `found`;
                }
            });
        } catch (_) {
            // Exit from forEach;
        }
        return index;
    }

    private _getChildIndex(node: Node): number {
        if (node.parentNode === null) {
            return -1;
        }
        let index: number = -1;
        try {
            Array.prototype.forEach.call(node.parentNode.children, (child: Node, i: number) => {
                if (node === child) {
                    index = i;
                    throw `found`;
                }
            });
        } catch (_) {
            // Exit from forEach;
        }
        return index;
    }
}

export function getFocusNodeInfo(): NodeInfo {
    return new NodeInfo(Target.Focus);
}

export function getAnchorNodeInfo(): NodeInfo {
    return new NodeInfo(Target.Anchor);
}
