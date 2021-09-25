import * as Toolkit from 'chipmunk.client.toolkit';

import { Subscription } from 'rxjs';
import {
    Selection,
    ISelectionAccessor,
    IRange,
    IRowPosition,
    ESource,
} from '../../controller/helpers/selection';
import { Session } from '../../controller/session/session';
import { IBookmark } from '../../controller/session/dependencies/bookmarks/controller.session.tab.stream.bookmarks';
import { IPC } from '../../services/service.electron.ipc';

import ElectronIpcService from '../../services/service.electron.ipc';
import EventsSessionService from './service.events.session';

export enum EKey {
    ctrl = 'ctrl',
    shift = 'shift',
    ignore = 'ignore',
}

export enum EParent {
    output = 'output',
    search = 'search',
    bookmark = 'bookmark',
    notification = 'notification',
    parsing = 'parsing',
    marker = 'marker',
    chart = 'chart',
    timemeasurement = 'timemeasurement',
    comment = 'comment',
    notassigned = 'notassigned',
    shell = 'shell',
}

interface IState {
    selection: Selection;
    cache: Map<number, string>;
    last: IRowPosition;
}

export { ISelectionAccessor, IRange };

export type THandler = (sender: string, selection: ISelectionAccessor, clicked: number) => void;

export interface IRangeExtended extends IRange {
    content?: {
        start: string;
        end: string;
    };
}

export class OutputRedirectionsService {
    private _logger: Toolkit.Logger = new Toolkit.Logger('OutputRedirectionsService');
    private _subscribers: Map<string, Map<string, THandler>> = new Map();
    private _subscriptions: { [key: string]: Subscription } = {};
    private _session: Session | undefined;
    private _state: Map<string, IState> = new Map();
    private _keyHolded: EKey | undefined;

    public init(session: Session | undefined) {
        this._subscriptions.onSessionChange =
            EventsSessionService.getObservable().onSessionChange.subscribe(
                this._onSessionChange.bind(this),
            );
        this._subscriptions.onSessionClosed =
            EventsSessionService.getObservable().onSessionClosed.subscribe(
                this._onSessionClosed.bind(this),
            );
        this._session = session;
        this._onGlobalKeyDown = this._onGlobalKeyDown.bind(this);
        this._onGlobalKeyUp = this._onGlobalKeyUp.bind(this);
        window.addEventListener('keydown', this._onGlobalKeyDown);
        window.addEventListener('keyup', this._onGlobalKeyUp);
        window.addEventListener('blur', this._onGlobalKeyUp);
    }

    public select(sender: EParent, sessionId: string, row: IRowPosition, str?: string, key?: EKey) {
        let state: IState | undefined = this._state.get(sessionId);
        const keyHolded =
            key === undefined ? this._keyHolded : key === EKey.ignore ? undefined : key;
        if (key !== undefined) {
            this._keyHolded = undefined;
        }
        if (keyHolded === undefined || state === undefined || !state.selection.isRelevant(row)) {
            state = {
                selection: new Selection(),
                cache: new Map(),
                last: { output: -1 },
            };
            state.selection.add(row);
        } else {
            switch (keyHolded) {
                case EKey.ctrl:
                    state.selection.add(row);
                    break;
                case EKey.shift:
                    if (state.last.output === -1) {
                        // Ignore, if we still have empty selection
                        break;
                    }
                    state.selection.add(
                        row.output < state.last.output ? row : state.last,
                        row.output > state.last.output ? row : state.last,
                    );
                    break;
            }
        }
        if (!state.cache.has(row.output) && typeof str === 'string') {
            state.cache.set(row.output, str);
        }
        state.last = row;
        this._state.set(sessionId, state);
        const handlers: Map<string, THandler> | undefined = this._subscribers.get(sessionId);
        if (handlers === undefined) {
            return;
        }
        handlers.forEach((handler: THandler) => {
            state !== undefined && handler(sender, state.selection, row.output);
        });
    }

    public clear(sessionId: string) {
        this._state.set(sessionId, {
            selection: new Selection(),
            cache: new Map(),
            last: { output: -1 },
        });
    }

    public isSelected(sessionId: string, position: number, source: ESource): boolean {
        const state: IState | undefined = this._state.get(sessionId);
        return state === undefined ? false : state.selection.isSelected(position, source);
    }

    public hasSelection(sessionId: string): boolean {
        const state: IState | undefined = this._state.get(sessionId);
        return state === undefined ? false : state.selection.getSelections().length > 0;
    }

    public subscribe(sessionId: string, handler: THandler): Toolkit.Subscription {
        let handlers: Map<string, THandler> | undefined = this._subscribers.get(sessionId);
        const handlerId: string = Toolkit.guid();
        if (handlers === undefined) {
            handlers = new Map();
        }
        handlers.set(handlerId, handler);
        this._subscribers.set(sessionId, handlers);
        return new Toolkit.Subscription(
            'RowChanged',
            this._unsubscribe.bind(this, sessionId, handlerId),
            handlerId,
        );
    }

    public getSelectionAccessor(sessionId: string): ISelectionAccessor | undefined {
        const state: IState | undefined = this._state.get(sessionId);
        return state === undefined ? undefined : state.selection;
    }

    public getSelectionRanges(sessionId: string): IRangeExtended[] {
        const state: IState | undefined = this._state.get(sessionId);
        return state === undefined
            ? []
            : state.selection.getSelections().map((range: IRange) => {
                  const sstr: string | undefined = state.cache.get(range.start.output);
                  const estr: string | undefined = state.cache.get(range.end.output);
                  if (sstr === undefined || estr === undefined) {
                      return range;
                  } else {
                      return Object.assign({ content: { start: sstr, end: estr } }, range);
                  }
              });
    }

    public getOutputSelectionRanges(sessionId: string): Promise<IRangeExtended[]> {
        const state: IState | undefined = this._state.get(sessionId);
        if (state === undefined) {
            return Promise.resolve([]);
        }
        const source: ESource | undefined = state.selection.getSource();
        if (source === undefined || source === ESource.output) {
            return Promise.resolve(this.getSelectionRanges(sessionId));
        }
        return new Promise((resolve, reject) => {
            if (this._session === undefined) {
                return reject(new Error(this._logger.error(`No active session available`)));
            }
            let bookmarks: IBookmark[] = Array.from(this._session.getBookmarks().get().values())
                .filter((bookmark: IBookmark) => {
                    return state.selection.isSelected(bookmark.position, ESource.search);
                })
                .sort((a, b) => (a.position > b.position ? 1 : -1));
            const arounds: { [key: number]: { after: number; before: number } } = {};
            let selection = state.selection.getSelections().filter((range) => {
                return range.start.output !== range.end.output
                    ? true
                    : bookmarks.find((bookmark) => bookmark.position === range.start.output) ===
                          undefined;
            });
            let changed = true;
            while (changed) {
                changed = false;
                selection = selection
                    .map((range) => {
                        if (range.start.search === -1) {
                            if (
                                bookmarks.find(
                                    (bookmark) => bookmark.position === range.start.output,
                                ) !== undefined
                            ) {
                                range.start.output += 1;
                                changed = true;
                            }
                        }

                        if (range.end.search === -1) {
                            if (
                                bookmarks.find(
                                    (bookmark) => bookmark.position === range.end.output,
                                ) !== undefined
                            ) {
                                range.end.output -= 1;
                                changed = true;
                            }
                        }
                        return range;
                    })
                    .filter((range) => {
                        return range.start.search !== -1
                            ? true
                            : range.start.output < range.end.output;
                    });
            }
            selection.forEach((range: IRange) => {
                if (range.start.search === -1) {
                    arounds[range.start.output] = { after: -1, before: -1 };
                }
                if (range.end.search === -1) {
                    arounds[range.end.output] = { after: -1, before: -1 };
                }
            });
            Promise.all(
                Object.keys(arounds).map((position: number | string) => {
                    return this.getIndexAround(parseInt(position as string, 10))
                        .then((result) => {
                            (arounds as any)[position] = result;
                        })
                        .catch((err: Error) => {
                            this._logger.error(
                                `Fail to request positions in search around ${position} in stream due error: ${err.message}.`,
                            );
                        });
                }),
            ).then(() => {
                const ranges: IRange[] = [];
                selection.forEach((range: IRange) => {
                    if (range.start.search === -1 && range.end.search === -1) {
                        const start = arounds[range.start.output];
                        const end = arounds[range.end.output];
                        if (start.after !== -1 && end.before !== -1) {
                            ranges.push({
                                start: { output: range.start.output, search: start.after },
                                end: { output: range.end.output, search: end.before },
                                id: Toolkit.guid(),
                            });
                            return;
                        }
                    } else if (range.start.search === -1) {
                        const around = arounds[range.start.output];
                        if (around.after !== -1) {
                            ranges.push({
                                start: { output: range.start.output, search: around.after },
                                end: { output: range.end.output, search: range.end.search },
                                id: Toolkit.guid(),
                            });
                            return;
                        }
                    }
                    if (range.end.search === -1) {
                        const around = arounds[range.end.output];
                        if (around.before !== -1) {
                            ranges.push({
                                start: { output: range.start.output, search: range.start.search },
                                end: { output: range.end.output, search: around.before },
                                id: Toolkit.guid(),
                            });
                            return;
                        }
                    } else {
                        ranges.push(range);
                    }
                });
                if (this._session === undefined) {
                    return reject(new Error(this._logger.error(`No active session available`)));
                }
                this._session
                    .getSessionStream()
                    .getRowsSelection(ranges)
                    .then((rows) => {
                        const merged: any[] = [];
                        rows.forEach((row) => {
                            bookmarks = bookmarks.filter((bookmark) => {
                                if (bookmark.position < row.positionInStream) {
                                    merged.push({
                                        position: -1,
                                        positionInStream: bookmark.position,
                                        str: bookmark.str,
                                    });
                                    return false;
                                } else {
                                    return true;
                                }
                            });
                            merged.push(row);
                        });
                        if (bookmarks.length !== 0) {
                            bookmarks.forEach((bookmark) => {
                                merged.push({
                                    position: -1,
                                    positionInStream: bookmark.position,
                                    str: bookmark.str,
                                });
                            });
                        }
                        const selection: Selection = new Selection(merged);
                        resolve(
                            selection.getSelections().map((range: IRange) => {
                                const sstr: string | undefined = state.cache.get(
                                    range.start.output,
                                );
                                const estr: string | undefined = state.cache.get(range.end.output);
                                if (sstr === undefined || estr === undefined) {
                                    return range;
                                } else {
                                    return Object.assign(
                                        { content: { start: sstr, end: estr } },
                                        range,
                                    );
                                }
                            }),
                        );
                    })
                    .catch((err: Error) => {
                        reject(
                            new Error(
                                this._logger.error(
                                    `Fail get connect for ranges due error: ${err.message}`,
                                ),
                            ),
                        );
                    });
            });
        });
    }

    public getHoldKey(): EKey | undefined {
        return this._keyHolded;
    }

    public getIndexAround(position: number): Promise<IPC.ISearchIndexAroundResponse> {
        return new Promise((resolve, reject) => {
            if (this._session === undefined) {
                return reject(new Error(this._logger.error(`No active session available`)));
            }
            ElectronIpcService.request<IPC.SearchIndexAroundResponse>(
                new IPC.SearchIndexAroundRequest({
                    session: this._session.getGuid(),
                    position: position,
                }),
                IPC.SearchIndexAroundResponse,
            )
                .then((response) => {
                    resolve({ after: response.after, before: response.before });
                })
                .catch(reject);
        });
    }

    private _unsubscribe(sessionId: string, handlerId: string) {
        const handlers: Map<string, THandler> | undefined = this._subscribers.get(sessionId);
        if (handlers === undefined) {
            return;
        }
        handlers.delete(handlerId);
        if (handlers.size === 0) {
            this._subscribers.delete(sessionId);
        } else {
            this._subscribers.set(sessionId, handlers);
        }
    }

    private _onSessionChange(controller: Session | undefined) {
        if (controller === undefined) {
            return;
        }
        this._session = controller;
        if (this._state.has(this._session.getGuid())) {
            return;
        }
        this._state.set(this._session.getGuid(), {
            selection: new Selection(),
            cache: new Map(),
            last: { output: -1 },
        });
    }

    private _onSessionClosed(guid: string) {
        if (this._session !== undefined && this._session.getGuid() === guid) {
            this._session = undefined;
        }
        this._state.delete(guid);
    }

    private _onGlobalKeyDown(event: KeyboardEvent) {
        if (event.key === 'Shift') {
            this._keyHolded = EKey.shift;
        } else if (event.key === 'Meta' || event.key === 'Control') {
            this._keyHolded = EKey.ctrl;
        }
    }

    private _onGlobalKeyUp() {
        this._keyHolded = undefined;
    }
}

export default new OutputRedirectionsService();
