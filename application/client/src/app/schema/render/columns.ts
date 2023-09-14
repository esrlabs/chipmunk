import { scope } from '@platform/env/scope';
import { hash } from '@platform/env/str';
import { Subject, Subjects } from '@platform/env/subscription';
import { error } from '@platform/log/utils';
import { bridge } from '@service/bridge';
import { LimittedValue } from '@ui/env/entities/value.limited';
import { scheme_color_0 } from '@ui/styles/colors';

import * as num from '@platform/env/num';

export interface Header {
    caption: string;
    desc: string;
    visible: boolean;
    width: LimittedValue | undefined;
    color: string | undefined;
    index: number;
}

export class Columns {
    protected readonly styles: Map<number, { [key: string]: string }> = new Map();
    protected readonly logger = scope.getLogger('Columns');
    protected readonly defaults: {
        headers: {
            caption: string;
            desc: string;
        }[];
        visability: boolean[] | boolean;
        widths: number[];
        min: number[] | number;
        max: number[] | number;
    };
    protected hash!: string;

    protected setup(): void {
        const headersVisability =
            this.defaults.visability instanceof Array
                ? this.defaults.visability
                : Array.from({ length: this.defaults.headers.length }, () => true);
        const maxWidths: number[] =
            this.defaults.max instanceof Array
                ? this.defaults.max
                : (Array.from(
                      { length: this.defaults.headers.length },
                      () => this.defaults.max,
                  ) as number[]);
        const minWidths: number[] =
            this.defaults.min instanceof Array
                ? this.defaults.min
                : (Array.from(
                      { length: this.defaults.headers.length },
                      () => this.defaults.min,
                  ) as number[]);
        this.headers.clear();
        this.styles.clear();
        this.defaults.headers.forEach(
            (
                desc: {
                    caption: string;
                    desc: string;
                },
                index: number,
            ) => {
                const header = {
                    caption: desc.caption,
                    desc: desc.desc,
                    width:
                        this.defaults.widths[index] === -1
                            ? undefined
                            : new LimittedValue(
                                  `column_width_${index}`,
                                  minWidths[index],
                                  maxWidths[index],
                                  this.defaults.widths[index],
                              ),
                    visible: headersVisability[index],
                    color: scheme_color_0,
                    index,
                };
                this.headers.set(index, header);
                this.styles.set(index, {
                    width: `${header.width === undefined ? '' : `${header.width.value}px`}`,
                });
            },
        );
        this.hash = this.getHash();
    }

    protected getHeader(index: number): Header | undefined {
        const header = this.headers.get(index);
        if (header === undefined) {
            this.logger.error(`Fail to find column with index=${index}`);
        }
        return header;
    }
    protected getHash(): string {
        return hash(
            Array.from(this.headers.values())
                .map((header) => header.caption)
                .join(';'),
        ).toString();
    }
    protected storage(): { load(): void; save(): void } {
        return {
            load: () => {
                bridge
                    .storage(this.hash)
                    .read()
                    .then((content: string) => {
                        try {
                            const headers = JSON.parse(content);
                            if (!(headers instanceof Array)) {
                                this.logger.error(
                                    `Content from file does not represent Headers as an Array. Gotten: ${typeof headers}`,
                                );
                                return;
                            }
                            if (headers.length !== this.headers.size) {
                                this.logger.error(
                                    `Mismatching header count from last session. Previous: ${headers.length}; current: ${this.headers.size}.`,
                                );
                                return;
                            }
                            Array.from(this.headers.values()).forEach(
                                (header: Header, index: number) => {
                                    if (headers[index].width !== undefined) {
                                        header.width?.set(headers[index].width);
                                        this.subjects.get().resized.emit(header.index);
                                    }
                                    if (headers[index].color !== undefined) {
                                        header.color = headers[index].color;
                                        this.subjects.get().colorize.emit(header.index);
                                    }
                                    if (header.visible !== headers[index].visible) {
                                        header.visible = headers[index].visible;
                                        this.subjects.get().visibility.emit(header.index);
                                    }
                                },
                            );
                        } catch (err) {
                            this.logger.error(`Fail to parse columns data due: ${error(err)}`);
                        }
                    })
                    .catch((err: Error) =>
                        this.logger.error(`Fail to load columns data due: ${err.message}`),
                    );
            },
            save: () => {
                bridge
                    .storage(this.hash)
                    .write(
                        JSON.stringify(
                            Array.from(this.headers.values()).map((header) => {
                                return {
                                    width:
                                        header.width === undefined ? undefined : header.width.value,
                                    color: header.color,
                                    visible: header.visible,
                                };
                            }),
                        ),
                    )
                    .catch((err: Error) => {
                        this.logger.error(`Fail to save columns data due: ${err.message}`);
                    });
            },
        };
    }

    public readonly headers: Map<number, Header> = new Map();
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
        this.defaults = {
            headers,
            visability,
            widths,
            min,
            max,
        };
        this.setup();
        this.storage().load();
    }

    public visibility(index: number): {
        get(): boolean;
        set(value?: boolean): void;
    } {
        const header = this.getHeader(index);
        return {
            get: (): boolean => {
                return header === undefined ? true : header.visible;
            },
            set: (value?: boolean): void => {
                if (header === undefined) {
                    return;
                }
                header.visible = value === undefined ? !header.visible : value;
                this.headers.set(index, header);
                this.subjects.get().visibility.emit(index);
                this.storage().save();
            },
        };
    }

    public color(index: number): {
        get(): string | undefined;
        set(color: string): void;
    } {
        const header = this.getHeader(index);
        return {
            get: (): string | undefined => {
                return header === undefined ? undefined : header.color;
            },
            set: (color: string): void => {
                if (header === undefined) {
                    return;
                }
                header.color = color;
                this.headers.set(index, header);
                this.subjects.get().colorize.emit(index);
                this.storage().save();
            },
        };
    }

    public width(index: number): {
        get(): number | undefined;
        set(width: number): void;
    } {
        const header = this.getHeader(index);
        return {
            get: (): number | undefined => {
                return header === undefined ? undefined : header.width?.value;
            },
            set: (width: number): void => {
                if (header === undefined) {
                    return;
                }
                if (!num.isValid(width)) {
                    this.logger.error(`Fail to set column's width: invalid width (${width})`);
                    return;
                }
                header.width !== undefined && header.width.set(width);
                this.headers.set(index, header);
                this.subjects.get().resized.emit(index);
                this.storage().save();
            },
        };
    }

    public style(index: number): { [key: string]: string } {
        const style = this.styles.get(index);
        if (style === undefined) {
            this.logger.error(`Fail to find styles of column with index=${index}`);
            return {};
        }
        const width = this.width(index).get();
        if (width === undefined) {
            style['width'] = '';
        } else {
            style['width'] = `${width}px`;
        }
        const color = this.color(index).get();
        style['color'] = color !== undefined ? color : '';
        return style;
    }

    public get(): {
        all(): Header[];
        visible(): Header[];
        byIndex(index: number): Header | undefined;
    } {
        return {
            all: (): Header[] => {
                return Array.from(this.headers.values());
            },
            visible: (): Header[] => {
                return Array.from(this.headers.values()).filter((h) => h.visible);
            },
            byIndex: (index: number): Header | undefined => {
                return this.getHeader(index);
            },
        };
    }

    public reset(): void {
        this.setup();
        this.storage().save();
        this.headers.forEach((_header: Header, index: number) => {
            this.subjects.get().visibility.emit(index);
            this.subjects.get().resized.emit(index);
            this.subjects.get().colorize.emit(index);
        });
    }
}
