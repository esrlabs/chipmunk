import { Subject, Subjects } from '@platform/env/subscription';
import { LimittedValue } from '@ui/env/entities/value.limited';

export interface Header {
    caption: string;
    desc: string;
    visible: boolean;
    width: LimittedValue | undefined;
    index: number;
}
export class Columns {
    public readonly headers: Header[];
    protected styles: Array<{ [key: string]: string }> = [];

    public subjects: Subjects<{
        resized: Subject<number>;
        visibility: Subject<void>;
    }> = new Subjects({
        resized: new Subject(),
        visibility: new Subject(),
    });

    constructor(
        headers: {
            caption: string;
            desc: string;
        }[],
        visability: boolean[] | boolean,
        widths: number[],
        min: number[] | number,
        max: number[] | number,
    ) {
        const headersVisability =
            visability instanceof Array
                ? visability
                : Array.from({ length: headers.length }, () => true);
        const maxWidths =
            max instanceof Array ? max : Array.from({ length: headers.length }, () => max);
        const minWidths =
            min instanceof Array ? min : Array.from({ length: headers.length }, () => min);
        this.headers = headers.map((header, i) => {
            return {
                caption: header.caption,
                desc: header.desc,
                width:
                    widths[i] === -1
                        ? undefined
                        : new LimittedValue(
                              `column_width_${i}`,
                              minWidths[i],
                              maxWidths[i],
                              widths[i],
                          ),
                visible: headersVisability[i],
                index: i,
            };
        });
        this.styles = this.headers.map((h) => {
            return { width: `${h.width === undefined ? '' : `${h.width.value}px`}` };
        });
    }

    public visible(column: number): boolean {
        if (this.headers[column] === undefined) {
            throw new Error(`Invalid index of column`);
        }
        return this.headers[column].visible;
    }

    public setWidth(column: number, width: number) {
        if (isNaN(width) || !isFinite(width)) {
            throw new Error(`Invalid width column value`);
        }
        const value = this.headers[column].width;
        value !== undefined && value.set(width);
        this.subjects.get().resized.emit(column);
    }

    public getWidth(column: number): number | undefined {
        const value = this.headers[column].width;
        return value !== undefined ? value.value : undefined;
    }

    public getStyle(column: number): { [key: string]: string } {
        const style = this.styles[column];
        if (style === undefined) {
            return {};
        }
        const width = this.getWidth(column);
        if (width === undefined) {
            style['width'] = '';
        } else {
            style['width'] = `${width}px`;
        }
        return style;
    }
}
