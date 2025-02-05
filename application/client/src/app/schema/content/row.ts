import { Session } from '@service/session/session';
import { Subject, Subscriber } from '@platform/env/subscription';
import { Nature } from '@platform/types/content';
import { EAlias } from '@service/session/dependencies/search/highlights/modifier';
import { GrabbedElement } from '@platform/types/bindings/miscellaneous';

export enum Owner {
    Output = 'Output',
    Search = 'Search',
    Bookmark = 'Bookmark',
    Chart = 'Chart',
    Attachment = 'Attachment',
    Comment = 'Comment',
    NestedSearch = 'NestedSearch',
}

export interface RowSrc {
    content: string;
    position: number;
    owner: Owner;
    source: number;
    session: Session;
    nature: Nature;
}

const MAX_ROW_LENGTH_LIMIT = 10000;

export interface IRow {
    content: string;
    position: number;
    owner: Owner;
    source: number;
    cropped: boolean;
    html: string;
    color: string | undefined;
    background: string | undefined;
    columns: string[];
    nature: Nature;
    seporator: boolean;
}

export class Row extends Subscriber {
    static removeMarkerSymbols(str: string): string {
        return str.replaceAll(/\u0004/gi, '').replaceAll(/\u0005/gi, '');
    }
    public content: string;
    public position: number;
    public owner: Owner;
    public source: number;
    public session: Session;
    public cropped: boolean;
    public change: Subject<void> = new Subject();
    public html!: string;
    public color: string | undefined;
    public background: string | undefined;
    public columns: string[] = [];
    public nature: Nature;
    public seporator: boolean = false;
    public matches: {
        active: boolean;
        filter: boolean;
        chart: boolean;
    } = {
        active: false,
        filter: false,
        chart: false,
    };

    protected readonly delimiter: string | undefined;

    private _hash: string = '';

    constructor(inputs: RowSrc) {
        super();
        this.nature = inputs.nature;
        this.session = inputs.session;
        this.cropped = inputs.content.length > MAX_ROW_LENGTH_LIMIT;
        this.content =
            inputs.content.length > MAX_ROW_LENGTH_LIMIT
                ? `${inputs.content.substring(0, MAX_ROW_LENGTH_LIMIT)}...`
                : inputs.content;
        this.position = inputs.position;
        this.owner = inputs.owner;
        this.source = inputs.source;
        this.delimiter = this.session.render.delimiter();
        this.update();
        this.register(
            this.session.highlights.subjects.get().update.subscribe(() => {
                this.softUpdate();
            }),
        );
    }

    public destroy() {
        this.change.destroy();
        this.unsubscribe();
    }

    public from(inputs: RowSrc) {
        this.content !== inputs.content && (this.content = inputs.content);
        this.position !== inputs.position && (this.position = inputs.position);
        this.owner !== inputs.owner && (this.owner = inputs.owner);
        this.source !== inputs.source && (this.source = inputs.source);
        this.session.uuid() !== inputs.session.uuid() && (this.session = inputs.session);
        this.nature !== inputs.nature && (this.nature = inputs.nature);
        this.seporator = this.isSeporator();
        this.softUpdate();
    }

    public as(): {
        grabbed(): GrabbedElement;
    } {
        return {
            grabbed: (): GrabbedElement => {
                return {
                    pos: this.position,
                    source_id: this.source,
                    content: this.content,
                    nature: 0,
                };
            },
        };
    }

    public bookmark(): {
        is(): boolean;
        toggle(): void;
    } {
        return {
            is: (): boolean => {
                return this.session.bookmarks.has(this.position);
            },
            toggle: (): void => {
                this.session.bookmarks.bookmark(this);
            },
        };
    }

    public select(): {
        is(): boolean;
        toggle(event: PointerEvent): void;
    } {
        return {
            is: (): boolean => {
                return this.session.cursor.isSelected(this.position);
            },
            toggle: (event: PointerEvent): void => {
                this.session.cursor.select(this.position, this.owner, event, this);
            },
        };
    }

    public extending(): {
        before(): void;
        after(): void;
    } {
        return {
            before: (): void => {
                if (!this.nature.seporator) {
                    return;
                }
                this.session.indexed.expand(this.position).before();
            },
            after: (): void => {
                if (!this.nature.seporator) {
                    return;
                }
                this.session.indexed.expand(this.position).after();
            },
        };
    }

    public serialized(): RowSrc {
        return {
            content: this.content,
            position: this.position,
            owner: this.owner,
            source: this.source,
            nature: this.nature,
            session: this.session,
        };
    }

    protected isSeporator(): boolean {
        if (this.owner !== Owner.Search) {
            return false;
        }
        return this.nature.seporator;
    }

    protected hash(): string {
        if (this.delimiter === undefined) {
            return `${this.color};${this.background};${this.html};${this.position};${this.seporator}`;
        } else {
            return `${this.color};${this.background};${this.columns.join(';')};${this.position};${
                this.seporator
            }`;
        }
    }

    protected update() {
        const matches = (injected: { [key: string]: boolean }) => {
            this.matches.active = injected[EAlias.Active];
            this.matches.filter = injected[EAlias.Filters];
            this.matches.chart = injected[EAlias.Charts];
        };
        if (this.delimiter === undefined) {
            const parsed = this.session.highlights.parse(
                this.position,
                Row.removeMarkerSymbols(this.content),
                this.owner,
                false,
            );
            matches(parsed.injected);
            this.html = parsed.html;
            this.color = parsed.color;
            this.background = parsed.background;
        } else {
            this.color = undefined;
            this.background = undefined;
            const columnsMap: [number, number][] = [];
            let cursor = 0;
            this.columns = this.content.split(this.delimiter).map((str) => {
                columnsMap.push([cursor, str.length]);
                cursor += str.length;
                return Row.removeMarkerSymbols(str);
            });
            const expected = this.session.render.columns();
            if (this.columns.length > expected) {
                this.columns.splice(expected - 1, this.columns.length - expected);
            } else if (this.columns.length < expected) {
                this.columns = this.columns.concat(
                    Array.from({ length: expected - this.columns.length }, () => ''),
                );
            }
            this.columns = this.columns.map((col, i) => {
                const parsed = this.session.highlights.parse(
                    this.position,
                    col,
                    this.owner,
                    false,
                    { column: i, map: columnsMap },
                );
                matches(parsed.injected);
                if (this.color === undefined && this.background === undefined) {
                    this.color = parsed.color;
                    this.background = parsed.background;
                }
                return parsed.html;
            });
        }
        this.seporator = this.isSeporator();
    }

    protected softUpdate() {
        this.update();
        const hash = this.hash();
        this._hash !== hash && this.change.emit();
        this._hash = hash;
    }
}
