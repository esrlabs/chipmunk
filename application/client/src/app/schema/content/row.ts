import { Session } from '@service/session/session';
import { Subject, Subscriber } from '@platform/env/subscription';
import { Nature } from '@platform/types/content';
import { EAlias } from '@service/session/dependencies/search/highlights/modifier';
import { GrabbedElement } from '@platform/types/bindings/miscellaneous';

/**
 * Declares the visual "owner" or container context in which a `Row` is rendered.
 *
 * @remarks
 * The `Owner` enum is used to distinguish between multiple visual log consumers,
 * such as the main output, search results, bookmarks, charts, and others.
 *
 * The concept of an "owner" is introduced to resolve event loop issues in UI logic:
 * for instance, a click on a log row in the main output window should not trigger
 * reactions within that same window. Instead, other views (like search results)
 * can react to such events and adjust their own state accordingly.
 *
 * This enables synchronized behavior between components while avoiding unintended recursive updates.
 *
 * @enum {string}
 * @public
 */
export enum Owner {
    /**
     * Main log output window.
     */
    Output = 'Output',

    /**
     * Search results view.
     */
    Search = 'Search',

    /**
     * Bookmark view containing marked rows.
     */
    Bookmark = 'Bookmark',

    /**
     * Charting window or graph view.
     */
    Chart = 'Chart',

    /**
     * Attachment container (e.g., linked file or artifact).
     */
    Attachment = 'Attachment',

    /**
     * Comment container (e.g., user-annotated row or discussion thread).
     */
    Comment = 'Comment',

    /**
     * Result of a nested search operation.
     */
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

/**
 * Represents a single log entry (row) received from the backend and processed for rendering.
 *
 * @remarks
 * Every log line from the backend is transformed into an instance of `Row`.
 * This class acts as the fundamental unit for log rendering, encapsulating all required
 * metadata and visual formatting attributes. It includes a reference to the owning session,
 * original content, display state, highlighting, coloring, column values, and more.
 *
 * The renderer operates exclusively on instances of this class.
 *
 * @extends Subscriber
 *
 * @public
 */
export class Row extends Subscriber {
    /**
     * Removes special marker symbols (e.g., control characters) from the given string.
     *
     * @param str - A string potentially containing marker symbols.
     * @returns A string without marker symbols.
     */
    static removeMarkerSymbols(str: string): string {
        return str.replaceAll(/\u0004/gi, '').replaceAll(/\u0005/gi, '');
    }

    /**
     * Original raw log content.
     */
    public content: string;

    /**
     * Absolute position of the row within the session's data stream.
     */
    public position: number;

    /**
     * Identifies the visual container (e.g., output, search, chart) responsible for rendering this row.
     */
    public owner: Owner;

    /**
     * Numeric ID of the log source (e.g., channel, stream, or plugin source).
     */
    public source: number;

    /**
     * The session to which this row belongs.
     */
    public session: Session;

    /**
     * Indicates whether the row's content was cropped during parsing or rendering.
     */
    public cropped: boolean;

    /**
     * Emits when the row's rendering state is updated (e.g., bookmarked, highlighted).
     * Note: content mutations are not supported and do not trigger this event.
     */
    public change: Subject<void> = new Subject();

    /**
     * Parsed and HTML-ready version of the row content, used for direct insertion into DOM.
     */
    public html!: string;

    /**
     * Optional text color assigned to this row.
     */
    public color: string | undefined;

    /**
     * Optional background color assigned to this row.
     */
    public background: string | undefined;

    /**
     * Optional columnar view of the row, if the session content supports tabular formatting.
     */
    public columns: string[] = [];

    /**
     * Describes the nature or classification of the row:
     * e.g., search result, bookmark, or breadcrumb (non-matching row in mixed search output).
     */
    public nature: Nature;

    /**
     * When `true`, the row is rendered as a visual separator instead of a content line.
     * Used primarily in breadcrumb display modes.
     */
    public seporator: boolean = false;

    /**
     * Flags indicating various match states of the row in relation to active search or filters.
     */
    public matches: {
        /**
         * `true` if the row matches the current active search query.
         */
        active: boolean;

        /**
         * `true` if the row matches current non-search filters.
         */
        filter: boolean;

        /**
         * `true` if the row matches filters relevant to chart or metrics views.
         */
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
