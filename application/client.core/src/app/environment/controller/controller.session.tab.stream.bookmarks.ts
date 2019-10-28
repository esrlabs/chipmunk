import * as Toolkit from 'chipmunk.client.toolkit';
import { Observable, Subject } from 'rxjs';

export interface IBookmark {
    str: string | undefined;
    position: number;
    pluginId: number;
    rank: number;
}

export class ControllerSessionTabStreamBookmarks {

    private _logger: Toolkit.Logger;
    private _sessionId: string;
    private _bookmarks: Map<number, IBookmark> = new Map();

    private _subjects: {
        onAdded: Subject<IBookmark>,
        onRemoved: Subject<number>
    } = {
        onAdded: new Subject<IBookmark>(),
        onRemoved: new Subject<number>()
    };

    constructor(session: string) {
        this._sessionId = session;
        this._logger = new Toolkit.Logger(`ControllerSessionBookmarks: ${session}`);
    }

    public destroy() {
    }

    public add(bookmark: IBookmark) {
        if (this._bookmarks.has(bookmark.position)) {
            return;
        }
        const stored: IBookmark = Object.assign({}, bookmark);
        this._bookmarks.set(bookmark.position, stored);
        this._subjects.onAdded.next(stored);
    }

    public remove(index: number) {
        if (!this._bookmarks.has(index)) {
            return;
        }
        this._bookmarks.delete(index);
        this._subjects.onRemoved.next(index);
    }

    public isBookmarked(index: number): boolean {
        return this._bookmarks.has(index);
    }

    public getObservable(): {
        onAdded: Observable<IBookmark>,
        onRemoved: Observable<number>,
    } {
        return {
            onAdded: this._subjects.onAdded.asObservable(),
            onRemoved: this._subjects.onRemoved.asObservable()
        };
    }

    public get(): Map<number, IBookmark> {
        return this._bookmarks;
    }

    public reset() {
        this._bookmarks.forEach((bookmark: IBookmark, key: number) => {
            this.remove(key);
        });
    }

}
