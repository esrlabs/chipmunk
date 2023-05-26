import { Session } from '@service/session/session';
import { Subject, Subscriber } from '@platform/env/subscription';
import { IGrabbedElement, Nature } from '@platform/types/content';
import { EAlias } from '@service/session/dependencies/search/highlights/modifier';
import { ansiToHtml } from '@module/ansi';

export enum Owner {
    Output = 'Output',
    Search = 'Search',
    Bookmark = 'Bookmark',
    Chart = 'Chart',
    Attachment = 'Attachment',
}

export interface RowInputs {
    content: string;
    position: number;
    owner: Owner;
    source: number;
    session: Session;
    nature: number;
}

const MAX_ROW_LENGTH_LIMIT = 10000;

export class Row extends Subscriber {
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

    constructor(inputs: RowInputs) {
        super();
        this.nature = new Nature(inputs.nature);
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
            this.session.search
                .highlights()
                .subjects.get()
                .update.subscribe(() => {
                    this.update();
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
            this.update();
        }
        this.color !== row.color && (this.color = row.color);
        this.background !== row.background && (this.background = row.background);
        this.position !== row.position && (this.position = row.position);
        this.owner !== row.owner && (this.owner = row.owner);
        this.source !== row.source && (this.source = row.source);
        this.session !== row.session && (this.session = row.session);
        this.cropped !== row.cropped && (this.cropped = row.cropped);
        this.nature = row.nature;
        this.seporator = this.isSeporator();
        this.change.emit();
    }

    public as(): {
        grabbed(): IGrabbedElement;
    } {
        return {
            grabbed: (): IGrabbedElement => {
                return {
                    position: this.position,
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

    protected isSeporator(): boolean {
        if (this.owner !== Owner.Search) {
            return false;
        }
        return this.nature.seporator;
    }

    protected update() {
        const matches = (injected: { [key: string]: boolean }) => {
            this.matches.active = injected[EAlias.Active];
            this.matches.filter = injected[EAlias.Filters];
            this.matches.chart = injected[EAlias.Charts];
        };
        if (this.delimiter === undefined) {
            const parsed = this.session.search.highlights().parse(this.content, this.owner, false);
            matches(parsed.injected);
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
}
