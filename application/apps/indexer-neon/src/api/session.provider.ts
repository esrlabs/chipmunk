import * as Events from '../util/events';

import { Computation } from '../provider/provider';
import { EErrorKind, EErrorSeverity } from '../provider/provider.errors';
import { IMapEntity, IMatchEntity } from '../interfaces/index';

export interface IProgressState {
    total: number;
    done: number;
}

export interface IProgressEvent {
    uuid: string;
    Progress: IProgressState;
}

export interface IError {
    severity: EErrorSeverity;
    kind: EErrorKind;
    message?: string;
}

export interface IErrorEvent {
    uuid: string;
    error: IError;
}

export interface IOperationDoneEvent {
    uuid: string;
    result: any;
}

export interface IEventMapUpdated {
    map: IMapEntity[];
}

export interface IEventMatchesUpdated {
    matches: IMatchEntity[];
}

export interface ISessionEvents {
    StreamUpdated: Events.Subject<number>;
    SearchUpdated: Events.Subject<number>;
    MapUpdated: Events.Subject<IEventMapUpdated>;
    MatchesUpdated: Events.Subject<IEventMatchesUpdated>;
    Progress: Events.Subject<IProgressEvent>;
    SessionError: Events.Subject<IError>;
    OperationError: Events.Subject<IErrorEvent>;
    SessionDestroyed: Events.Subject<void>;
    OperationDone: Events.Subject<IOperationDoneEvent>;
}

interface ISessionEventsSignatures {
    StreamUpdated: 'StreamUpdated';
    SearchUpdated: 'SearchUpdated';
    MapUpdated: 'MapUpdated';
    MatchesUpdated: 'MatchesUpdated';
    Progress: 'Progress';
    SessionError: 'SessionError';
    OperationError: 'OperationError';
    SessionDestroyed: 'SessionDestroyed';
    OperationDone: 'OperationDone';
}

const SessionEventsSignatures: ISessionEventsSignatures = {
    StreamUpdated: 'StreamUpdated',
    SearchUpdated: 'SearchUpdated',
    MapUpdated: 'MapUpdated',
    MatchesUpdated: 'MatchesUpdated',
    Progress: 'Progress',
    SessionError: 'SessionError',
    OperationError: 'OperationError',
    SessionDestroyed: 'SessionDestroyed',
    OperationDone: 'OperationDone',
};

interface ISessionEventsInterfaces {
    StreamUpdated: { self: 'number' };
    SearchUpdated: { self: 'number' };
    MapUpdated: { self: 'object'; map: typeof Array };
    MatchesUpdated: { self: 'object'; matches: typeof Array };
    Progress: {
        self: 'object';
        uuid: 'string';
        progress: { self: 'object'; total: 'number'; done: 'number' };
    };
    SessionError: { self: 'object'; severity: 'string'; message: 'string'; kind: 'string' };
    OperationError: {
        self: 'object';
        uuid: 'string';
        error: { self: 'object'; severity: 'string'; message: 'string'; kind: 'string' };
    };
    SessionDestroyed: { self: null };
    OperationDone: { self: 'object', uuid: 'string', result: 'any' };
}

const SessionEventsInterfaces: ISessionEventsInterfaces = {
    StreamUpdated: { self: 'number' },
    SearchUpdated: { self: 'number' },
    MapUpdated: { self: 'object', map: Array },
    MatchesUpdated: { self: 'object', matches: Array },
    Progress: {
        self: 'object',
        uuid: 'string',
        progress: { self: 'object', total: 'number', done: 'number' },
    },
    SessionError: { self: 'object', severity: 'string', message: 'string', kind: 'string' },
    OperationError: {
        self: 'object',
        uuid: 'string',
        error: { self: 'object', severity: 'string', message: 'string', kind: 'string' },
    },
    SessionDestroyed: { self: null },
    OperationDone: { self: 'object', uuid: 'string', result: 'any' },
};

export class EventProvider extends Computation<ISessionEvents, ISessionEventsSignatures, ISessionEventsInterfaces> {

    private readonly _events: ISessionEvents = {
        StreamUpdated: new Events.Subject<number>(),
        SearchUpdated: new Events.Subject<number>(),
        MapUpdated: new Events.Subject<IEventMapUpdated>(),         // dummy
        MatchesUpdated: new Events.Subject<IEventMatchesUpdated>(), // dummy
        Progress: new Events.Subject<IProgressEvent>(),
        SessionError: new Events.Subject<IError>(),
        OperationError: new Events.Subject<IErrorEvent>(),
        SessionDestroyed: new Events.Subject<void>(),
        OperationDone: new Events.Subject<IOperationDoneEvent>(),
    };

    constructor(uuid: string) {
        super(uuid);
    }

    public getName(): string {
        return 'EventProvider';
    }

    public getEvents(): ISessionEvents {
        return this._events;
    }

    public getEventsSignatures(): ISessionEventsSignatures {
        return SessionEventsSignatures;
    }

    public getEventsInterfaces(): ISessionEventsInterfaces {
        return SessionEventsInterfaces;
    }

}
