import * as Events from '../util/events';

export enum EErrorSeverity {
    warn = 'warn',
    error = 'error',
    logs = 'logs',
}

export interface IError {
    severity: EErrorSeverity;
    content: string;
    row?: number;
    filename?: string;
}

export interface IEvents {
    /**
     * @event error { IError }
     * Calls on any error on rust side. Emitting of @event error doesn't mean 
     * stopping of operation.
     */
    error: Events.Subject<IError>,
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
    error: { self: 'object', severity: 'string', content: 'string' };
    destroyed: { self: null };
}


export const EventsInterfaces: IEventsInterfaces = {
    error: { self: 'object', severity: 'string', content: 'string' },
    destroyed: { self: null },
}