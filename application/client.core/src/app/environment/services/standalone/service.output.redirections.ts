import * as Toolkit from 'chipmunk.client.toolkit';

import { Subscription } from 'rxjs';
import { Selection, ISelectionAccessor, IRange, IRowPosition, ESource } from '../../controller/helpers/selection';
import { Session } from '../../controller/session/session';

import EventsSessionService from './service.events.session';

export enum EKey {
    ctrl = 'ctrl',
    shift = 'shift'
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
        this._subscriptions.onSessionChange = EventsSessionService.getObservable().onSessionChange.subscribe(this._onSessionChange.bind(this));
        this._subscriptions.onSessionClosed = EventsSessionService.getObservable().onSessionClosed.subscribe(this._onSessionClosed.bind(this));
        this._session = session;
        this._onGlobalKeyDown = this._onGlobalKeyDown.bind(this);
        this._onGlobalKeyUp = this._onGlobalKeyUp.bind(this);
        window.addEventListener('keydown', this._onGlobalKeyDown);
        window.addEventListener('keyup', this._onGlobalKeyUp);
        window.addEventListener('blur', this._onGlobalKeyUp);
    }

    public select(sender: EParent, sessionId: string, row: IRowPosition, str?: string) {
        let state: IState | undefined = this._state.get(sessionId);
        if (this._keyHolded === undefined || state === undefined || !state.selection.isRelevant(row)) {
            state = {
                selection: new Selection(),
                cache: new Map(),
                last: { output: -1 },
            };
            state.selection.add(row);
        } else {
            switch (this._keyHolded) {
                case EKey.ctrl:
                    state.selection.add(row);
                    break;
                case EKey.shift:
                    if (state.last.output === -1) {
                        // Ignore, if we still have empty selection
                        break;
                    }
                    state.selection.add(row.output < state.last.output ? row : state.last, row.output > state.last.output ? row : state.last);
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
            handler(sender, state.selection, row.output);
        });
    }

    public isSelected(sessionId: string, position: number, source: ESource): boolean {
        const state: IState | undefined = this._state.get(sessionId);
        return state === undefined ? false : state.selection.isSelected(position, source);
    }

    public subscribe(sessionId: string, handler: THandler): Toolkit.Subscription {
        let handlers: Map<string, THandler> | undefined = this._subscribers.get(sessionId);
        const handlerId: string = Toolkit.guid();
        if (handlers === undefined) {
            handlers = new Map();
        }
        handlers.set(handlerId, handler);
        this._subscribers.set(sessionId, handlers);
        return new Toolkit.Subscription('RowChanged', this._unsubscribe.bind(this, sessionId, handlerId), handlerId);
    }

    public getSelectionAccessor(sessionId: string): ISelectionAccessor | undefined {
        const state: IState | undefined = this._state.get(sessionId);
        return state === undefined ? undefined : state.selection;
    }

    public getSelectionRanges(sessionId: string): IRangeExtended[] {
        const state: IState | undefined = this._state.get(sessionId);
        return state === undefined ? [] : state.selection.getSelections().map((range: IRange) => {
            const sstr: string | undefined = state.cache.get(range.start.output);
            const estr: string | undefined = state.cache.get(range.end.output);
            if (sstr === undefined || estr === undefined) {
                return range;
            } else {
                return Object.assign({ content: { start: sstr, end: estr }}, range);
            }
        });
    }

    public getOutputSelectionRanges(sessionId: string): Promise<IRangeExtended[] | undefined> {
        const state: IState | undefined = this._state.get(sessionId);
        if (state === undefined) {
            return Promise.resolve(undefined);
        }
        const source: ESource | undefined = state.selection.getSource();
        if (source === undefined || source === ESource.output) {
            return Promise.resolve(this.getSelectionRanges(sessionId));
        }
        return new Promise((resolve, reject) => {
            this._session.getSessionStream().getRowsSelection(state.selection.getSelections()).then((rows) => {
                const selection: Selection = new Selection(rows);
                resolve(selection.getSelections().map((range: IRange) => {
                    const sstr: string | undefined = state.cache.get(range.start.output);
                    const estr: string | undefined = state.cache.get(range.end.output);
                    if (sstr === undefined || estr === undefined) {
                        return range;
                    } else {
                        return Object.assign({ content: { start: sstr, end: estr }}, range);
                    }
                }));
            }).catch((err: Error) => {
                reject(new Error(this._logger.error(`Fail get connect for ranges due error: ${err.message}`)));
            });
        });
    }

    public getHoldKey(): EKey | undefined {
        return this._keyHolded;
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

    private _onSessionChange(controller: Session) {
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
        if (this._session.getGuid() === guid) {
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

    private _onGlobalKeyUp(event: KeyboardEvent) {
        this._keyHolded = undefined;
    }

}


export default (new OutputRedirectionsService());
