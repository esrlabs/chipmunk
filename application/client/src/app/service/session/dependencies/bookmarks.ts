import { SetupLogger, LoggerInterface } from '@platform/entity/logger';
import { Subscriber, Subjects, Subject } from '@platform/env/subscription';
import { Owner, Row } from '@schema/content/row';
import { cutUuid } from '@log/index';
import { Bookmark } from './bookmark/bookmark';
import { Range } from '@platform/types/range';
import { Cursor } from './cursor';
import { hotkeys } from '@service/hotkeys';

@SetupLogger()
export class Bookmarks extends Subscriber {
    public readonly subjects: Subjects<{
        updated: Subject<void>;
    }> = new Subjects({
        updated: new Subject<void>(),
    });
    private _uuid!: string;
    protected bookmarks: Bookmark[] = [];
    protected cursor!: Cursor;

    public init(uuid: string, cursor: Cursor) {
        this.setLoggerName(`Bookmarks: ${cutUuid(uuid)}`);
        this._uuid = uuid;
        this.cursor = cursor;
        this.register(
            hotkeys.listen('j', () => {
                this.move().prev();
            }),
        );
        this.register(
            hotkeys.listen('k', () => {
                this.move().next();
            }),
        );
    }

    public destroy() {
        this.unsubscribe();
        this.subjects.destroy();
    }

    public bookmark(row: Row) {
        const exist = this.bookmarks.find((b) => b.stream() === row.position.stream);
        if (exist) {
            this.bookmarks = this.bookmarks.filter((b) => b.stream() !== row.position.stream);
        } else {
            this.bookmarks.push(new Bookmark(row.as().inputs()));
        }
        this.bookmarks.sort((a, b) => {
            return a.stream() < b.stream() ? -1 : 1;
        });
        this.subjects.get().updated.emit();
    }

    public is(stream: number): boolean {
        return this.bookmarks.find((b) => b.stream() === stream) !== undefined;
    }

    public count(): number {
        return this.bookmarks.length;
    }

    public get(range?: Range): Bookmark[] {
        if (range === undefined) {
            return this.bookmarks;
        } else {
            return this.bookmarks.filter((b) => range.in(b.stream()));
        }
    }

    public getRowsPositions(): number[] {
        return this.bookmarks.map((b) => b.stream());
    }

    protected move(): {
        next(): void;
        prev(): void;
    } {
        const selected: number | undefined = (() => {
            if (this.bookmarks.length === 0) {
                return undefined;
            }
            const single = this.cursor.getSingle();
            if (single === undefined) {
                this.cursor.select(this.bookmarks[0].as().row(0), Owner.Bookmark);
                return undefined;
            }
            return this.bookmarks.findIndex((b) => b.stream() === single.position.stream);
        })();
        return {
            next: (): void => {
                if (selected === undefined) {
                    return;
                }
                if (selected === -1) {
                    this.cursor.select(this.bookmarks[0].as().row(0), Owner.Bookmark);
                    return;
                }
                if (selected === this.bookmarks.length - 1) {
                    return;
                }
                this.cursor.select(this.bookmarks[selected + 1].as().row(0), Owner.Bookmark);
            },
            prev: (): void => {
                if (selected === undefined) {
                    return;
                }
                if (selected === -1) {
                    this.cursor.select(
                        this.bookmarks[this.bookmarks.length - 1].as().row(0),
                        Owner.Bookmark,
                    );
                    return;
                }
                if (selected === 0) {
                    return;
                }
                this.cursor.select(this.bookmarks[selected - 1].as().row(0), Owner.Bookmark);
            },
        };
    }
}
export interface Bookmarks extends LoggerInterface {}
