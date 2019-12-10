import * as Toolkit from 'chipmunk.client.toolkit';
import { Subscription, Observable } from 'rxjs';

interface IControllerCroppedInterface {
    getGuid: () => string;
}

export type THandler = (sender: string, row: number, prev: number | undefined) => void;

export class OutputRedirectionsService {

    private _logger: Toolkit.Logger = new Toolkit.Logger('OutputRedirectionsService');
    private _subscribers: Map<string, Map<string, THandler>> = new Map();
    private _subscriptions: { [key: string]: Subscription } = {};
    private _sessionId: string | undefined;
    private _selected: Map<string, number> = new Map();

    public init(sessionId: string, observels: {
        onSessionChange: Observable<IControllerCroppedInterface | undefined>,
        onSessionClosed: Observable<string>
    }) {
        this._subscriptions.onSessionChange = observels.onSessionChange.subscribe(this._onSessionChange.bind(this));
        this._subscriptions.onSessionClosed = observels.onSessionClosed.subscribe(this._onSessionClosed.bind(this));
        this._sessionId = sessionId;
    }

    public select(sender: string, sessionId: string, row: number) {
        const prev: number | undefined = this._selected.get(sessionId);
        this._selected.set(sessionId, row);
        const handlers: Map<string, THandler> | undefined = this._subscribers.get(sessionId);
        if (handlers === undefined) {
            return;
        }
        handlers.forEach((handler: THandler) => {
            handler(sender, row, prev);
        });
    }

    public isSelected(sessionId: string, position: number): boolean {
        return this._selected.get(sessionId) === position;
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
        if (this._selected.has(this._sessionId)) {
            return;
        }
        this._selected.set(this._sessionId, -1);
    }

    private _onSessionClosed(sessionId: string) {
        if (this._sessionId === sessionId) {
            this._sessionId = undefined;
        }
        this._selected.delete(sessionId);
    }

}


export default (new OutputRedirectionsService());
