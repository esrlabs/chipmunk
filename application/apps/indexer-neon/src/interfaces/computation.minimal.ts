import * as Events from '../util/events';

export interface IEvents {
    /**
     * @event error { Error }
     * Calls on any error on rust side. Emitting of @event error doesn't mean 
     * stopping of operation.
     */
    error: Events.Subject<Error>,
    /**
     * @event destroyed { void }
     * Calls always as soon as instance of computation is destroyed. No any
     * events should be called after "destroyed" event was emited
     */
    destroyed: Events.Subject<void>,
}

export interface IEventsSignatures {
    error: 'error';
    destroyed: 'destroyed';
}

export const EventsSignatures: IEventsSignatures = {
    error: 'error',
    destroyed: 'destroyed',
}

export interface IEventsInterfaces {
    error: { self: typeof Error };
    destroyed: { self: null };
}