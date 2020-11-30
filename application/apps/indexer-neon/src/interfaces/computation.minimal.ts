import * as Events from '../util/events';
import { IComputationError } from './errors';

export interface IEvents {
    /**
     * @event error { IError }
     * Calls on any error on rust side. Emitting of @event error doesn't mean 
     * stopping of operation.
     */
    error: Events.Subject<IComputationError>,
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
    error: { self: 'object', severity: 'string', message: 'string' };
    destroyed: { self: null };
}


export const EventsInterfaces: IEventsInterfaces = {
    error: { self: 'object', severity: 'string', message: 'string' },
    destroyed: { self: null },
}