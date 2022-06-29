import { SetupLogger, LoggerInterface } from '@platform/entity/logger';
import { Subscriber, Subjects, Subject } from '@platform/env/subscription';
import { Row } from '@schema/content/row';
import { cutUuid } from '@log/index';
import { Bookmark } from './bookmark/bookmark';
import { Range } from '@platform/types/range';

@SetupLogger()
export class Bookmarks extends Subscriber {
    public readonly subjects: Subjects<{
        updated: Subject<void>;
    }> = new Subjects({
        updated: new Subject<void>(),
    });
    private _uuid!: string;
    protected bookmarks: Bookmark[] = [];

    public init(uuid: string) {
        this.setLoggerName(`Bookmarks: ${cutUuid(uuid)}`);
        this._uuid = uuid;
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
}
export interface Bookmarks extends LoggerInterface {}
