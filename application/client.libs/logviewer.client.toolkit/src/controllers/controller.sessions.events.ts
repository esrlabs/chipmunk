import Emitter from '../tools/tools.emitter';
import Subscription from '../tools/tools.subscription';

export { Subscription };

export type TSubscriptionHandler<T> = (params: T) => any;

export class ControllerSessionsEvents {

    public static Events = {
        onSessionChange: 'onSessionChange',
        onSessionOpen: 'onSessionOpen',
        onSessionClose: 'onSessionClose',
    };

    private _emitter: Emitter = new Emitter();

    public destroy() {
        this._emitter.unsubscribeAll();
    }

    public unsubscribe(event: any) {
        this._emitter.unsubscribeAll(event);
    }

    public emit(): {
        onSessionChange: (sessionId: string) => void,
        onSessionOpen: (sessionId: string) => void,
        onSessionClose: (sessionId: string) => void,
    } {
        return {
            onSessionChange: this._getEmit.bind(this, ControllerSessionsEvents.Events.onSessionChange),
            onSessionOpen: this._getEmit.bind(this, ControllerSessionsEvents.Events.onSessionOpen),
            onSessionClose: this._getEmit.bind(this, ControllerSessionsEvents.Events.onSessionClose),
        };
    }

    public subscribe(): {
        onSessionChange: (handler: TSubscriptionHandler<string>) => Subscription,
        onSessionOpen: (handler: TSubscriptionHandler<string>) => Subscription,
        onSessionClose: (handler: TSubscriptionHandler<string>) => Subscription,
    } {
        return {
            onSessionChange: (handler: TSubscriptionHandler<string>) => {
                return this._getSubscription<string>(ControllerSessionsEvents.Events.onSessionChange, handler);
            },
            onSessionOpen: (handler: TSubscriptionHandler<string>) => {
                return this._getSubscription<string>(ControllerSessionsEvents.Events.onSessionOpen, handler);
            },
            onSessionClose: (handler: TSubscriptionHandler<string>) => {
                return this._getSubscription<string>(ControllerSessionsEvents.Events.onSessionClose, handler);
            },
        };
    }

    private _getSubscription<T>(event: string, handler: TSubscriptionHandler<T>): Subscription {
        this._emitter.subscribe(event, handler);
        return new Subscription(event, () => {
            this._emitter.unsubscribe(event, handler);
        });
    }

    private _getEmit<T>(event: string, params: T): void {
        this._emitter.emit(event, params);
    }
}
