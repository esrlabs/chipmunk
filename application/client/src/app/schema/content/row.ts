import { Session } from '@service/session/session';
import { serializeHtml } from '@platform/env/str';
import { Subject, Subscriber } from '@platform/env/subscription';

export interface Position {
    stream: number;
    view: number;
}

export enum Owner {
    Output = 'Output',
    Search = 'Search',
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

    constructor(inputs: RowInputs) {
        super();
        this.session = inputs.session;
        this.cropped = inputs.content.length > MAX_ROW_LENGTH_LIMIT;
        this.content =
            inputs.content.length > MAX_ROW_LENGTH_LIMIT
                ? `${inputs.content.substring(0, MAX_ROW_LENGTH_LIMIT)}...`
                : inputs.content;
        this.content = serializeHtml(this.content);
        this.position = inputs.position;
        this.owner = inputs.owner;
        this.source = inputs.source;
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

    public columns(): string[] {
        const delimiter: string | undefined = this.session.render.delimiter();
        if (delimiter === undefined) {
            return [this.content];
        } else {
            let columns: string[] = this.content.split(delimiter);
            const expected = this.session.render.columns();
            if (columns.length > expected) {
                columns.splice(expected - 1, columns.length - expected);
            } else if (columns.length < expected) {
                columns = columns.concat(
                    Array.from({ length: expected - columns.length }, () => ''),
                );
            }
            return columns;
        }
    }

    public as(): {
        inputs(): StaticRowInputs;
    } {
        return {
            inputs: (): StaticRowInputs => {
                return {
                    content: this.content,
                    stream: this.position.stream,
                    source: this.source,
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
                this.session.cursor.select(this.position.stream, this.owner);
            },
        };
    }

    private _update() {
        const parsed = this.session.search.highlights().parse(this.content, this.owner, false);
        this.html = parsed.html;
        this.color = parsed.color;
        this.background = parsed.background;
    }
}
