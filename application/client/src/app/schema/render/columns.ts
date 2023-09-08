import { scope } from '@platform/env/scope';
import { hash } from '@platform/env/str';
import { Subject, Subjects } from '@platform/env/subscription';
import { error } from '@platform/log/utils';
import { bridge } from '@service/bridge';
import { LimittedValue } from '@ui/env/entities/value.limited';
import { scheme_color_0, scheme_color_default } from '@ui/styles/colors';
import { v4 as uuidv4 } from 'uuid';

export interface Header {
    caption: string;
    desc: string;
    visible: boolean;
    width: LimittedValue | undefined;
    color: string | undefined;
    index: number;
    uuid: string;
}
export class Columns {
    public readonly headers: Header[];
    protected styles: Array<{ [key: string]: string }> = [];

    public subjects: Subjects<{
        resized: Subject<number>;
        visibility: Subject<number>;
        colorize: Subject<number>;
    }> = new Subjects({
        resized: new Subject(),
        visibility: new Subject(),
        colorize: new Subject(),
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
                color: scheme_color_0,
                index: i,
                uuid: uuidv4(),
            };
        });
        this.styles = this.headers.map((h) => {
            return { width: `${h.width === undefined ? '' : `${h.width.value}px`}` };
        });
        this.storage().load();
    }

    public toggleVisibility(uuid: string, value?: boolean): void {
        const headerIndex = this.headers.findIndex((header) => header.uuid === uuid);
        if (headerIndex === undefined) {
            throw new Error(`Header with UUID ${uuid} is not present`);
        }
        this.headers[headerIndex].visible =
            value === undefined ? !this.headers[headerIndex].visible : value;
        this.subjects.get().visibility.emit(headerIndex);
        this.storage().save();
    }

    public visible(column: number): boolean {
        if (this.headers[column] === undefined) {
            throw new Error(`Invalid index of column`);
        }
        return this.headers[column].visible;
    }

    public setColor(uuid: string, color: string): void {
        const column = this.headers.findIndex(h => h.uuid === uuid);
        if (this.headers[column] === undefined) {
            throw new Error(`Header with UUID ${uuid} is not present`);
        }
        this.headers[column].color = (color === scheme_color_default) ? scheme_color_0 : color;
        this.subjects.get().colorize.emit(column);
        this.storage().save();
    }

    public getColor(column: number): string | undefined {
        if (this.headers[column] === undefined) {
            throw new Error(
                `Maximum ${this.headers.length} present in the file and tried to get the color of column at #${column}`
            );
        }
        return this.headers[column].color;
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

        const color = this.getColor(column);
        style['color'] = color !== undefined ? color : '';

        return style;
    }

    protected hash(): string {
        return hash(this.headers.map((header) => header.caption).join(';')).toString();
    }

    protected storage(): { load(): void; save(): void } {
        const logger = scope.getLogger('columnsController');

        return {
            load: () => {
                bridge
                .storage(this.hash())
                .read()
                .then((content) => {
                    try {
                        const headers = JSON.parse(content);
                        if (!(headers instanceof Array)) {
                            throw new Error(
                                'Content from file does not represent Headers as an Array'
                            );
                        }
                        if (headers.length !== this.headers.length) {
                            throw new Error(`Mismatching header count from last session`);
                        }
                        this.headers.forEach((header, index) => {
                            if (headers[index].width !== undefined) {
                                header.width?.set(headers[index].width);
                                this.subjects.get().resized.emit(index);
                            }
                            if (headers[index].color !== undefined) {
                                header.color = headers[index].color;
                                this.subjects.get().colorize.emit(index);
                            }
                            if (header.visible !== headers[index].visible) {
                                header.visible = headers[index].visible;
                                this.subjects.get().visibility.emit(index);
                            }
                        });
                    } catch (err) {
                        logger.error(error(err));
                    }
                })
                .catch(error => logger.error(error));
            },
            save: () => {
                bridge
                .storage(this.hash())
                .write(
                    JSON.stringify(
                        this.headers.map((header) => {
                            return {
                                width:
                                    header.width === undefined ? undefined : header.width.value,
                                color: header.color,
                                visible: header.visible,
                            };
                        }),
                    ),
                )
                .catch((error) => {
                    logger.error(error);
                });
            },
        }
    }
}
