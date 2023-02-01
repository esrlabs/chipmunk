import { Collection, AfterApplyCallback } from './collection';
import { Bookmark } from '../session/dependencies/bookmark/bookmark';
import { Extractor } from '@platform/types/storage/json';
import { Equal } from '@platform/types/env/types';
import { Session } from '@service/session/session';
import { Definition } from './definition';
import { Subscriber } from '@platform/env/subscription';

export class BookmarksCollection
    extends Collection<Bookmark>
    implements Equal<BookmarksCollection>
{
    constructor() {
        super('BookmarksCollection', []);
    }

    public subscribe(subscriber: Subscriber, session: Session): void {
        subscriber.register(
            session.bookmarks.subjects.get().updated.subscribe(() => {
                this.update(session.bookmarks.get());
                this.updated.emit();
            }),
        );
    }

    public async applyTo(session: Session, definitions: Definition[]): Promise<AfterApplyCallback> {
        // Bookmarks can be applied only to file
        if (
            definitions.length !== 1 ||
            definitions[0].file === undefined ||
            session.bookmarks.get().length !== 0
        ) {
            return () => {
                /* do nothing */
            };
        }
        await session.bookmarks.overwrite(this.as().elements());
        return () => {
            session.bookmarks.update();
        };
    }

    public isSame(collection: Collection<Bookmark>): boolean {
        if (this.elements.size !== collection.elements.size) {
            return false;
        }
        let found = 0;
        const elements = Array.from(this.elements.values());
        collection.elements.forEach((outside) => {
            found += elements.find((f) => f.isSame(outside)) === undefined ? 0 : 1;
        });
        return collection.elements.size === found;
    }

    public extractor(): Extractor<Bookmark> {
        return {
            from: (json: string): Bookmark | Error => {
                return Bookmark.fromJson(json);
            },
            key: (): string => {
                return Bookmark.KEY;
            },
        };
    }

    public applicableOnlyToOrigin(): boolean {
        return true;
    }
}
