import * as Toolkit from 'chipmunk.client.toolkit';
import { Observable, Subject } from 'rxjs';
import HotkeysService, { IHotkeyEvent } from '../services/service.hotkeys';
import { Subscription } from 'rxjs';

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
    private _subscriptions: { [key: string]: Toolkit.Subscription | Subscription } = {};
    private _current: number = -1;

    private _subjects: {
        onAdded: Subject<IBookmark>,
        onRemoved: Subject<number>,
        onSelected: Subject<number>,
    } = {
        onAdded: new Subject<IBookmark>(),
        onRemoved: new Subject<number>(),
        onSelected: new Subject<number>()
    };

    constructor(session: string) {
        this._sessionId = session;
        this._logger = new Toolkit.Logger(`ControllerSessionBookmarks: ${session}`);
        this._subscriptions.selectNextRow = HotkeysService.getObservable().selectNextRow.subscribe(this._selectNextRow.bind(this));
        this._subscriptions.selectPrevRow = HotkeysService.getObservable().selectPrevRow.subscribe(this._selectPrevRow.bind(this));
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
        onSelected: Observable<number>,
    } {
        return {
            onAdded: this._subjects.onAdded.asObservable(),
            onRemoved: this._subjects.onRemoved.asObservable(),
            onSelected: this._subjects.onSelected.asObservable()
        };
    }

    public get(): Map<number, IBookmark> {
        return this._bookmarks;
    }

    public getNumberBookmarksBefore(row: number): number {
        const keys: number[] = Array.from(this._bookmarks.keys());
        let count: number = 0;
        keys.forEach((key: number) => {
            if (row > key) {
                count += 1;
            }
        });
        return count;
    }

    public reset() {
        this._bookmarks.forEach((bookmark: IBookmark, key: number) => {
            this.remove(key);
        });
    }

    private _goto(key: number) {
        const bookmark: IBookmark | undefined = this._bookmarks.get(key);
        if (bookmark === undefined) {
            return;
        }
        this._subjects.onSelected.next(bookmark.position);
    }

    private _selectNextRow(event: IHotkeyEvent) {
        if (event.session !== this._sessionId) {
            return;
        }
        const keys: number[] = Array.from(this._bookmarks.keys()).sort((a, b) => a > b ? 1 : -1);
        if (keys.length === 0) {
            return;
        }
        this._current += 1;
        if (this._current > keys.length - 1 || isNaN(this._current) || !isFinite(this._current)) {
            this._current = 0;
        }
        const key: number = keys[this._current];
        this._goto(key);
    }

    private _selectPrevRow(event: IHotkeyEvent) {
        if (event.session !== this._sessionId) {
            return;
        }
        const keys: number[] = Array.from(this._bookmarks.keys()).sort((a, b) => a > b ? 1 : -1);
        if (keys.length === 0) {
            return;
        }
        this._current -= 1;
        if (this._current < 0 || isNaN(this._current) || !isFinite(this._current)) {
            this._current = keys.length - 1;
        }
        const key: number = keys[this._current];
        this._goto(key);
    }


}
