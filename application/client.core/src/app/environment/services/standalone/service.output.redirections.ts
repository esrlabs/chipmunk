import * as Toolkit from 'chipmunk.client.toolkit';
import { Subscription, Observable } from 'rxjs';

interface IControllerCroppedInterface {
    getGuid: () => string;
}

enum EKey {
    ctrl = 'ctrl',
    shift = 'shift'
}

interface IState {
    selection: number[];
    last: number;
}
export type THandler = (sender: string, selection: number[], clicked: number) => void;

export class OutputRedirectionsService {

    private _logger: Toolkit.Logger = new Toolkit.Logger('OutputRedirectionsService');
    private _subscribers: Map<string, Map<string, THandler>> = new Map();
    private _subscriptions: { [key: string]: Subscription } = {};
    private _sessionId: string | undefined;
    private _state: Map<string, IState> = new Map();
    private _keyHolded: EKey | undefined;

    public init(sessionId: string, observels: {
        onSessionChange: Observable<IControllerCroppedInterface | undefined>,
        onSessionClosed: Observable<string>
    }) {
        this._subscriptions.onSessionChange = observels.onSessionChange.subscribe(this._onSessionChange.bind(this));
        this._subscriptions.onSessionClosed = observels.onSessionClosed.subscribe(this._onSessionClosed.bind(this));
        this._sessionId = sessionId;
        this._onGlobalKeyDown = this._onGlobalKeyDown.bind(this);
        this._onGlobalKeyUp = this._onGlobalKeyUp.bind(this);
        window.addEventListener('keydown', this._onGlobalKeyDown);
        window.addEventListener('keyup', this._onGlobalKeyUp);
    }

    public select(sender: string, sessionId: string, row: number) {
        let state: IState | undefined = this._state.get(sessionId);
        if (this._keyHolded === undefined || state === undefined) {
            state = {
                selection: [row],
                last: -1,
            };
        } else {
            switch (this._keyHolded) {
                case EKey.ctrl:
                    if (state.selection.indexOf(row) === -1) {
                        // Add new row into selection
                        state.selection.push(row);
                    } else {
                        // Remove row from selection
                        state.selection.splice(state.selection.indexOf(row), 1);
                    }
                    break;
                case EKey.shift:
                    if (state.selection.length === 0 && row > 0) {
                        // Set start position to the beggining
                        state.selection.push(1);
                    }
                    if (state.selection.length === 0 || state.last === -1) {
                        // Ignore, if we still have empty selection
                        break;
                    }
                    if (state.last < row) {
                        // From top to bottom
                        for (let i = state.last + 1; i <= row; i += 1) {
                            state.selection.push(i);
                        }
                    } else if (state.last > row) {
                        // From bottom to top
                        for (let i = row; i < state.last; i += 1) {
                            state.selection.unshift(i);
                        }
                    } else if (state.last === row && state.selection.indexOf(state.last) !== -1) {
                        // Bottom equal to new selection
                        state.selection.splice(state.selection.indexOf(state.last), 1);
                    }
                    break;
            }
            const selection: number[] = [];
            state.selection.forEach((num: number) => {
                if (selection.indexOf(num) === -1) {
                    selection.push(num);
                }
            });
            selection.sort(function(a, b) {
                return a - b;
            });
            state.selection = selection;
        }
        state.last = row;
        this._state.set(sessionId, state);
        const handlers: Map<string, THandler> | undefined = this._subscribers.get(sessionId);
        if (handlers === undefined) {
            return;
        }
        handlers.forEach((handler: THandler) => {
            handler(sender, state.selection, row);
        });
    }

    public isSelected(sessionId: string, position: number): boolean {
        const state: IState | undefined = this._state.get(sessionId);
        return state === undefined ? false : state.selection.indexOf(position) !== -1;
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

    public getSelection(sessionId: string): number[] | undefined {
        const state: IState | undefined = this._state.get(sessionId);
        return state === undefined ? undefined : state.selection;
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

    private _onSessionChange(controller: { getGuid: () => string }) {
        if (controller === undefined) {
            return;
        }
        this._sessionId = controller.getGuid();
        if (this._state.has(this._sessionId)) {
            return;
        }
        this._state.set(this._sessionId, {
            selection: [],
            last: -1
        });
    }

    private _onSessionClosed(sessionId: string) {
        if (this._sessionId === sessionId) {
            this._sessionId = undefined;
        }
        this._state.delete(sessionId);
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
