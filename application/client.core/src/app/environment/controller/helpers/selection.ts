import * as Toolkit from 'chipmunk.client.toolkit';

import { IRow } from '../session/dependencies/row/controller.row.api';

export interface IRowPosition {
    output: number;
    search?: number;
}

export interface IRange {
    start: IRowPosition;
    end: IRowPosition;
    id: string;
}

export interface ISelectionAccessor {
    isSelected: (position: number, source: ESource) => boolean;
    getSelections: () => IRange[];
}

export enum ESource {
    output,
    search,
}

export class Selection implements ISelectionAccessor {
    private _selection: Map<string, IRange> = new Map();
    private _prev: ESource | undefined;

    constructor(rows?: IRow[]) {
        if (rows !== undefined) {
            let start: IRow | undefined;
            let prev: IRow | undefined;
            rows.forEach((row: IRow) => {
                if (start === undefined) {
                    start = row;
                } else if (start.positionInStream === row.positionInStream - 1) {
                    prev = row;
                } else if (start.positionInStream !== row.positionInStream - 1) {
                    this.add(
                        { output: start.positionInStream },
                        prev === undefined ? undefined : { output: prev.positionInStream },
                    );
                    start = row;
                    prev = undefined;
                }
            });
            if (start !== undefined) {
                this.add(
                    { output: start.positionInStream },
                    prev === undefined ? undefined : { output: prev.positionInStream },
                );
            }
        }
    }

    public add(from: IRowPosition, to?: IRowPosition): Error | undefined {
        const current: ESource = from.search !== undefined ? ESource.search : ESource.output;
        this._prev = this._prev === undefined ? current : this._prev;
        if (this._prev !== current) {
            return new Error(`Selection source dismatch`);
        }
        if (to === undefined) {
            this._addSingleRow(from);
        } else {
            if (
                (from.search !== undefined && to.search === undefined) ||
                (from.search === undefined && to.search !== undefined)
            ) {
                // Both should have search or shoundn't
                return undefined;
            }
            this._addRowsRange(from, to);
        }
        const selection = window.getSelection();
        if ((to !== undefined || this._selection.size > 1) && selection !== null) {
            selection.removeAllRanges();
        }
        this._prev = current;
        return undefined;
    }

    public isSelected(position: number, source: ESource): boolean {
        if (source !== this._prev) {
            return false;
        }
        let result: boolean = false;
        this._selection.forEach((range: IRange) => {
            if (range.start.output <= position && range.end.output >= position) {
                result = true;
            }
        });
        return result;
    }

    public getSelections(): IRange[] {
        const ranges: IRange[] = Array.from(this._selection.values());
        ranges.sort((a: IRange, b: IRange) => {
            return a.start.output - b.start.output;
        });
        return ranges;
    }

    public isRelevant(row: IRowPosition): boolean {
        const checking: ESource = row.search !== undefined ? ESource.search : ESource.output;
        const expecting = this._prev === undefined ? checking : this._prev;
        return checking === expecting;
    }

    public getSource(): ESource | undefined {
        return this._prev;
    }

    private _addSingleRow(position: IRowPosition) {
        let included: IRange | undefined;
        let guid: string = '';
        this._selection.forEach((range: IRange) => {
            if (range.start.output <= position.output && range.end.output >= position.output) {
                included = range;
            }
        });
        if (included === undefined) {
            guid = Toolkit.guid();
            this._selection.set(guid, {
                start: position,
                end: position,
                id: guid,
            });
        } else {
            this._selection.delete(included.id);
            // Add left
            if (included.start.output !== position.output) {
                guid = Toolkit.guid();
                this._selection.set(guid, {
                    start: included.start,
                    end: {
                        output: position.output - 1,
                        search: position.search !== undefined ? position.search - 1 : undefined,
                    },
                    id: guid,
                });
            }
            // Add right
            if (included.end !== position) {
                guid = Toolkit.guid();
                this._selection.set(guid, {
                    start: {
                        output: position.output + 1,
                        search: position.search !== undefined ? position.search + 1 : undefined,
                    },
                    end: included.end,
                    id: guid,
                });
            }
        }
    }

    private _addRowsRange(from: IRowPosition, to: IRowPosition) {
        let guid: string = '';
        if (this._selection.size === 0) {
            guid = Toolkit.guid();
            this._selection.set(guid, {
                start: from,
                end: to,
                id: guid,
            });
        } else {
            this._selection.forEach((range: IRange, id: string) => {
                if (
                    (range.start.output <= from.output && range.end.output >= from.output) ||
                    (range.start.output <= to.output && range.end.output >= to.output) ||
                    (range.start.output >= from.output && range.start.output <= to.output)
                ) {
                    if (from.output > range.start.output) {
                        from = range.start;
                    }
                    if (to.output < range.end.output) {
                        to = range.end;
                    }
                    this._selection.delete(id);
                }
            });
            guid = Toolkit.guid();
            this._selection.set(guid, {
                start: from,
                end: to,
                id: guid,
            });
        }
    }
}
