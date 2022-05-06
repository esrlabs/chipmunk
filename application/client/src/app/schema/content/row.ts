import { Session } from '@service/session/session';
import { serializeHtml } from '@platform/env/str';
import { Subject } from '@platform/env/subscription';

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

const MAX_ROW_LENGTH_LIMIT = 10000;

export class Row {
    public content: string;
    public position: Position;
    public owner: Owner;
    public source: number;
    public session: Session;
    public cropped: boolean;
    public change: Subject<void> = new Subject();

    constructor(inputs: RowInputs) {
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
    }

    public destroy() {
        this.change.destroy();
    }

    public from(row: Row) {
        this.content !== row.content && (this.content = row.content);
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
}
