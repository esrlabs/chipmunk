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

    public overwrite(bookmarks: Bookmark[], silence: boolean = false) {
        this.bookmarks = bookmarks;
        this.bookmarks.sort((a, b) => {
            return a.position < b.position ? -1 : 1;
        });
        !silence && this.update();
    }

    public bookmark(row: Row) {
        const exist = this.bookmarks.find((b) => b.position === row.position);
        if (exist) {
            this.bookmarks = this.bookmarks.filter((b) => b.position !== row.position);
        } else {
            this.bookmarks.push(new Bookmark(row.position));
        }
        this.bookmarks.sort((a, b) => {
            return a.position < b.position ? -1 : 1;
        });
        this.update();
    }

    public is(stream: number): boolean {
        return this.bookmarks.find((b) => b.position === stream) !== undefined;
    }

    public count(): number {
        return this.bookmarks.length;
    }

    public get(range?: Range): Bookmark[] {
        if (range === undefined) {
            return this.bookmarks;
        } else {
            return this.bookmarks.filter((b) => range.in(b.position));
        }
    }

    public getRowsPositions(): number[] {
        return this.bookmarks.map((b) => b.position);
    }

    public hash(): string {
        return this.getRowsPositions().join(',');
    }

    public update(): void {
        this.subjects.get().updated.emit();
    }

    protected move(): {
        next(): void;
        prev(): void;
    } {
        const selected: number | undefined = (() => {
            if (this.bookmarks.length === 0) {
                return undefined;
            }
            const single = this.cursor.getSingle().position();
            if (single === undefined) {
                this.cursor.select(this.bookmarks[0].position, Owner.Bookmark);
                return undefined;
            }
            return this.bookmarks.findIndex((b) => b.position === single);
        })();
        return {
            next: (): void => {
                if (selected === undefined) {
                    return;
                }
                if (selected === -1) {
                    this.cursor.select(this.bookmarks[0].position, Owner.Bookmark);
                    return;
                }
                if (selected === this.bookmarks.length - 1) {
                    return;
                }
                this.cursor.select(this.bookmarks[selected + 1].position, Owner.Bookmark);
            },
            prev: (): void => {
                if (selected === undefined) {
                    return;
                }
                if (selected === -1) {
                    this.cursor.select(
                        this.bookmarks[this.bookmarks.length - 1].position,
                        Owner.Bookmark,
                    );
                    return;
                }
                if (selected === 0) {
                    return;
                }
                this.cursor.select(this.bookmarks[selected - 1].position, Owner.Bookmark);
            },
        };
    }
}
export interface Bookmarks extends LoggerInterface {}
