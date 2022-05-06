import { Subject } from '@platform/env/subscription';
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
    private readonly _uuid: string;
    private _rank: number = 0;

    constructor(
        uuid: string,
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
        this._uuid = uuid;
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
    }

    public update: Subject<void> = new Subject<void>();

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
        this.update.emit();
    }

    public getWidth(column: number): number | undefined {
        const value = this.headers[column].width;
        return value !== undefined ? value.value : undefined;
    }
}
