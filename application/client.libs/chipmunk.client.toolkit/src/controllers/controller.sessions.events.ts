import Emitter from '../tools/tools.emitter';
import Subscription from '../tools/tools.subscription';

export { Subscription };

export interface IEventStreamUpdate {
    rows: number;
    session: string;
}

export interface IEventSearchUpdate {
    rows: number;
    session: string;
}

export type TSubscriptionHandler<T> = (params: T) => any;

/**
 * This class provides access to sessions events (like close, open, change of session).
 *
 * @usecases to track sessions state
 * @class ControllerSessionsEvents
 */
export class ControllerSessionsEvents {
    public static Events = {
        /**
         * Fired on user switch a tab (session)
         * @name onSessionChange
         * @event {string} sessionId - active session ID
         */
        onSessionChange: 'onSessionChange',
        /**
         * Fired on user open a new tab (session)
         * @name onSessionOpen
         * @event {string} sessionId - a new session ID
         */
        onSessionOpen: 'onSessionOpen',
        /**
         * Fired on user close a new tab (session)
         * @name onSessionClose
         * @event {string} sessionId - ID of closed session
         */
        onSessionClose: 'onSessionClose',
        /**
         * Fired on stream has been changed
         * @name onStreamUpdated
         * @event {IEventStreamUpdate} event - current state of stream
         */
        onStreamUpdated: 'onStreamUpdated',
        /**
         * Fired on search results has been changed
         * @name onSearchUpdated
         * @event {IEventSearchUpdate} event - current state of stream
         */
        onSearchUpdated: 'onSearchUpdated',
    };

    private _emitter: Emitter = new Emitter();

    public destroy() {
        this._emitter.unsubscribeAll();
    }

    public unsubscribe(event: any) {
        this._emitter.unsubscribeAll(event);
    }

    /**
     * Emits event
     * @returns {Event Emitter} - function event emitter
     */
    public emit(): {
        onSessionChange: (sessionId: string | undefined) => void;
        onSessionOpen: (sessionId: string) => void;
        onSessionClose: (sessionId: string) => void;
        onStreamUpdated: (event: IEventStreamUpdate) => void;
        onSearchUpdated: (event: IEventSearchUpdate) => void;
    } {
        return {
            onSessionChange: this._getEmit.bind(
                this,
                ControllerSessionsEvents.Events.onSessionChange,
            ),
            onSessionOpen: this._getEmit.bind(this, ControllerSessionsEvents.Events.onSessionOpen),
            onSessionClose: this._getEmit.bind(
                this,
                ControllerSessionsEvents.Events.onSessionClose,
            ),
            onStreamUpdated: this._getEmit.bind(
                this,
                ControllerSessionsEvents.Events.onStreamUpdated,
            ),
            onSearchUpdated: this._getEmit.bind(
                this,
                ControllerSessionsEvents.Events.onSearchUpdated,
            ),
        };
    }

    /**
     * Subscribes to event
     * @returns {Event Subscriber} - function-subscriber for each available event
     */
    public subscribe(): {
        onSessionChange: (handler: TSubscriptionHandler<string>) => Subscription;
        onSessionOpen: (handler: TSubscriptionHandler<string>) => Subscription;
        onSessionClose: (handler: TSubscriptionHandler<string>) => Subscription;
        onStreamUpdated: (handler: TSubscriptionHandler<IEventStreamUpdate>) => Subscription;
        onSearchUpdated: (handler: TSubscriptionHandler<IEventSearchUpdate>) => Subscription;
    } {
        return {
            onSessionChange: (handler: TSubscriptionHandler<string>) => {
                return this._getSubscription<string>(
                    ControllerSessionsEvents.Events.onSessionChange,
                    handler,
                );
            },
            onSessionOpen: (handler: TSubscriptionHandler<string>) => {
                return this._getSubscription<string>(
                    ControllerSessionsEvents.Events.onSessionOpen,
                    handler,
                );
            },
            onSessionClose: (handler: TSubscriptionHandler<string>) => {
                return this._getSubscription<string>(
                    ControllerSessionsEvents.Events.onSessionClose,
                    handler,
                );
            },
            onStreamUpdated: (handler: TSubscriptionHandler<IEventStreamUpdate>) => {
                return this._getSubscription<IEventStreamUpdate>(
                    ControllerSessionsEvents.Events.onStreamUpdated,
                    handler,
                );
            },
            onSearchUpdated: (handler: TSubscriptionHandler<IEventSearchUpdate>) => {
                return this._getSubscription<IEventSearchUpdate>(
                    ControllerSessionsEvents.Events.onSearchUpdated,
                    handler,
                );
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
