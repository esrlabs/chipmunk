import * as Toolkit from 'logviewer.client.toolkit';

export type THandler = (sender: string, row: number) => void;

export class OutputRedirectionsService {

    private _logger: Toolkit.Logger = new Toolkit.Logger('OutputRedirectionsService');
    private _subscriptions: Map<string, Map<string, THandler>> = new Map();

    public select(sender: string, sessionId: string, row: number) {
        const handlers: Map<string, THandler> | undefined = this._subscriptions.get(sessionId);
        if (handlers === undefined) {
            return;
        }
        handlers.forEach((handler: THandler) => {
            handler(sender, row);
        });
    }

    public subscribe(sessionId: string, handler: THandler): Toolkit.Subscription {
        let handlers: Map<string, THandler> | undefined = this._subscriptions.get(sessionId);
        const handlerId: string = Toolkit.guid();
        if (handlers === undefined) {
            handlers = new Map();
        }
        handlers.set(handlerId, handler);
        this._subscriptions.set(sessionId, handlers);
        return new Toolkit.Subscription('RowChanged', this._unsubscribe.bind(this, sessionId, handlerId), handlerId);
    }

    private _unsubscribe(sessionId: string, handlerId: string) {
        const handlers: Map<string, THandler> | undefined = this._subscriptions.get(sessionId);
        if (handlers === undefined) {
            return;
        }
        handlers.delete(handlerId);
        if (handlers.size === 0) {
            this._subscriptions.delete(sessionId);
        } else {
            this._subscriptions.set(sessionId, handlers);
        }
    }

}

export default (new OutputRedirectionsService());
