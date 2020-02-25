import * as Toolkit from 'chipmunk.client.toolkit';

export interface IRange {
    start: number;
    end: number;
    id: string;
}

export interface ISelectionAccessor {
    isSelected: (position: number) => boolean;
    getSelections: () => IRange[];
}

export class Selection implements ISelectionAccessor {

    private _selection: Map<string, IRange> = new Map();

    public add(from: number, to?: number) {
        if (to === undefined) {
            this._addSingleRow(from);
        } else {
            this._addRowsRange(from, to);
        }
    }

    public isSelected(position: number): boolean {
        let result: boolean = false;
        this._selection.forEach((range: IRange) => {
            if (range.start <= position && range.end >= position) {
                result = true;
            }
        });
        return result;
    }

    public getSelections(): IRange[] {
        const ranges: IRange[] = Array.from(this._selection.values());
        ranges.sort((a: IRange, b: IRange) => {
            return a.start - b.start;
        });
        return ranges;
    }

    private _addSingleRow(position: number) {
        let included: IRange | undefined;
        let guid: string = '';
        this._selection.forEach((range: IRange) => {
            if (range.start <= position && range.end >= position) {
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
            if (included.start !== position) {
                guid = Toolkit.guid();
                this._selection.set(guid, {
                    start: included.start,
                    end: position - 1,
                    id: guid,
                });
            }
            // Add right
            if (included.end !== position) {
                guid = Toolkit.guid();
                this._selection.set(guid, {
                    start: position + 1,
                    end: included.end,
                    id: guid,
                });
            }
        }
    }

    private _addRowsRange(from: number, to: number) {
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
                if ((range.start <= from && range.end >= from) ||
                    (range.start <= to && range.end >= to) ||
                    (range.start >= from && range.start <= to)) {
                    if (from > range.start) {
                        from = range.start;
                    }
                    if (to < range.end) {
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
