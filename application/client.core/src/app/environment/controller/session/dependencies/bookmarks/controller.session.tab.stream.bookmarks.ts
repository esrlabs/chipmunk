import * as Toolkit from 'chipmunk.client.toolkit';
import { Observable, Subject } from 'rxjs';
import HotkeysService, { IHotkeyEvent } from '../../../../services/service.hotkeys';
import { Subscription } from 'rxjs';
import { IRow } from '../row/controller.row.api';
import { Importable } from '../importer/controller.session.importer.interface';
import { Dependency, SessionGetter } from '../session.dependency';

export interface IBookmark {
    str: string | undefined;
    position: number;
    pluginId: number;
}

export class ControllerSessionTabStreamBookmarks
    extends Importable<number[]>
    implements Dependency
{
    private _logger: Toolkit.Logger;
    private _uuid: string;
    private _bookmarks: Map<number, IBookmark> = new Map();
    private _subscriptions: { [key: string]: Toolkit.Subscription | Subscription } = {};
    private _current: number = -1;

    private _subjects: {
        onAdded: Subject<IBookmark>;
        onRemoved: Subject<number>;
        onSelected: Subject<number>;
        onExport: Subject<void>;
    } = {
        onAdded: new Subject<IBookmark>(),
        onRemoved: new Subject<number>(),
        onSelected: new Subject<number>(),
        onExport: new Subject<void>(),
    };
    private readonly _session: SessionGetter;

    constructor(uuid: string, getter: SessionGetter) {
        super();
        this._uuid = uuid;
        this._session = getter;
        this._logger = new Toolkit.Logger(`ControllerSessionBookmarks: ${uuid}`);
    }

    public init(): Promise<void> {
        return new Promise((resolve, reject) => {
            this._subscriptions.selectNextRow =
                HotkeysService.getObservable().selectNextRow.subscribe(
                    this._selectNextRow.bind(this),
                );
            this._subscriptions.selectPrevRow =
                HotkeysService.getObservable().selectPrevRow.subscribe(
                    this._selectPrevRow.bind(this),
                );
            resolve();
        });
    }

    public destroy(): Promise<void> {
        return Promise.resolve();
    }

    public getName(): string {
        return 'ControllerSessionTabStreamBookmarks';
    }

    public add(bookmark: IBookmark) {
        if (this._bookmarks.has(bookmark.position)) {
            return;
        }
        const stored: IBookmark = Object.assign({}, bookmark);
        this._bookmarks.set(bookmark.position, stored);
        this._subjects.onAdded.next(stored);
        this._subjects.onExport.next();
    }

    public remove(index: number) {
        if (!this._bookmarks.has(index)) {
            return;
        }
        this._bookmarks.delete(index);
        this._subjects.onRemoved.next(index);
        this._subjects.onExport.next();
    }

    public isBookmarked(index: number): boolean {
        return this._bookmarks.has(index);
    }

    public getObservable(): {
        onAdded: Observable<IBookmark>;
        onRemoved: Observable<number>;
        onSelected: Observable<number>;
    } {
        return {
            onAdded: this._subjects.onAdded.asObservable(),
            onRemoved: this._subjects.onRemoved.asObservable(),
            onSelected: this._subjects.onSelected.asObservable(),
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

    public getExportObservable(): Observable<void> {
        return this._subjects.onExport.asObservable();
    }

    public getImporterUUID(): string {
        return 'bookmarks';
    }

    public export(): Promise<number[] | undefined> {
        return new Promise((resolve) => {
            if (this._bookmarks.size === 0) {
                return resolve(undefined);
            }
            resolve(Array.from(this._bookmarks.values()).map((b) => b.position));
        });
    }

    public import(positions: number[]): Promise<void> {
        return new Promise((resolve, reject) => {
            this._bookmarks.clear();
            positions = positions
                .map((smth: any) => {
                    if (typeof smth === 'number' && isFinite(smth) && !isNaN(smth)) {
                        return smth;
                    }
                    if (
                        typeof smth === 'object' &&
                        smth !== null &&
                        typeof smth.position === 'number' &&
                        isFinite(smth.position) &&
                        !isNaN(smth.position)
                    ) {
                        return smth.position;
                    } else {
                        return undefined;
                    }
                })
                .filter((p) => p !== undefined);
            this._session()
                .getSessionStream()
                .getRowsSelection(
                    positions.map((pos: number, i: number) => {
                        return {
                            start: { output: pos },
                            end: { output: pos },
                            id: `${i}`,
                        };
                    }),
                )
                .then((rows: IRow[]) => {
                    rows.forEach((row: IRow) => {
                        if (positions.indexOf(row.position) === -1) {
                            return;
                        }
                        const bookmark: IBookmark = {
                            str: row.str,
                            pluginId: row.pluginId,
                            position: row.position,
                        };
                        this._bookmarks.set(bookmark.position, bookmark);
                        this._subjects.onAdded.next(bookmark);
                        this._subjects.onExport.next();
                    });
                })
                .catch((err: Error) => {
                    this._logger.warn(`Fail to restore bookmark due error: ${err.message}`);
                })
                .finally(() => resolve(undefined));
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
        if (event.session !== this._uuid) {
            return;
        }
        const keys: number[] = Array.from(this._bookmarks.keys()).sort((a, b) => (a > b ? 1 : -1));
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
        if (event.session !== this._uuid) {
            return;
        }
        const keys: number[] = Array.from(this._bookmarks.keys()).sort((a, b) => (a > b ? 1 : -1));
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
