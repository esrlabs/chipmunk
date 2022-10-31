import { Session } from '@service/session/session';
import { Subject, Subscriber } from '@platform/env/subscription';
import { IGrabbedElement } from '@platform/types/content';
import { ansiToHtml } from '@module/ansi';

export interface Position {
    stream: number;
    view: number;
}

export enum Owner {
    Output = 'Output',
    Search = 'Search',
    Bookmark = 'Bookmark',
}

export interface RowInputs {
    content: string;
    position: Position;
    owner: Owner;
    source: number;
    session: Session;
}

export interface StaticRowInputs {
    content: string;
    stream: number;
    source: number;
}

const MAX_ROW_LENGTH_LIMIT = 10000;

export class Row extends Subscriber {
    public content: string;
    public position: Position;
    public owner: Owner;
    public source: number;
    public session: Session;
    public cropped: boolean;
    public change: Subject<void> = new Subject();
    public html!: string;
    public color: string | undefined;
    public background: string | undefined;
    public columns: string[] = [];

    protected readonly delimiter: string | undefined;

    constructor(inputs: RowInputs) {
        super();
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
        this._update();
        this.register(
            this.session.search
                .highlights()
                .subjects.get()
                .update.subscribe(() => {
                    this._update();
                    this.change.emit();
                }),
        );
    }

    public destroy() {
        this.change.destroy();
        this.unsubscribe();
    }

    public from(row: Row) {
        if (this.content !== row.content) {
            this.content = row.content;
            this._update();
        }
        this.position !== row.position && (this.position = row.position);
        this.owner !== row.owner && (this.owner = row.owner);
        this.source !== row.source && (this.source = row.source);
        this.session !== row.session && (this.session = row.session);
        this.cropped !== row.cropped && (this.cropped = row.cropped);
        this.change.emit();
    }

    public as(): {
        inputs(): StaticRowInputs;
        grabbed(row: number): IGrabbedElement;
    } {
        return {
            inputs: (): StaticRowInputs => {
                return {
                    content: this.content,
                    stream: this.position.stream,
                    source: this.source,
                };
            },
            grabbed: (row: number): IGrabbedElement => {
                return {
                    position: this.position.stream,
                    source_id: this.source,
                    content: this.content,
                    row,
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
                return this.session.bookmarks.is(this.position.stream);
            },
            toggle: (): void => {
                this.session.bookmarks.bookmark(this);
            },
        };
    }

    public select(): {
        is(): boolean;
        toggle(): void;
    } {
        return {
            is: (): boolean => {
                return this.session.cursor.isSelected(this.position.stream);
            },
            toggle: (): void => {
                this.session.cursor.select(this, this.owner);
            },
        };
    }

    private _update() {
        if (this.delimiter === undefined) {
            const parsed = this.session.search.highlights().parse(this.content, this.owner, false);
            const ansi = ansiToHtml(parsed.html);
            this.html = ansi instanceof Error ? parsed.html : ansi;
            this.color = parsed.color;
            this.background = parsed.background;
        } else {
            this.color = undefined;
            this.background = undefined;
            this.columns = this.content.split(this.delimiter);
            const expected = this.session.render.columns();
            if (this.columns.length > expected) {
                this.columns.splice(expected - 1, this.columns.length - expected);
            } else if (this.columns.length < expected) {
                this.columns = this.columns.concat(
                    Array.from({ length: expected - this.columns.length }, () => ''),
                );
            }
            this.columns = this.columns.map((col) => {
                const parsed = this.session.search.highlights().parse(col, this.owner, false);
                if (this.color === undefined && this.background === undefined) {
                    this.color = parsed.color;
                    this.background = parsed.background;
                }
                return parsed.html;
            });
        }
    }
}
