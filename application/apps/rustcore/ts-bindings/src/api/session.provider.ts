import { Subject } from 'platform/env/subscription';
import { ISearchUpdated } from 'platform/types/filter';
import { Computation } from '../provider/provider';
import { EErrorKind, EErrorSeverity } from '../provider/provider.errors';
import { IMapEntity, IMatchEntity } from '../interfaces/index';
import { SearchValuesResultOrigin } from '../api/executors/session.stream.searchvalues.executor';

export interface IProgressState {
    total: number;
    count: number;
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

export interface IEventIndexedMapUpdated {
    len: number;
}

export interface IEventMatchesUpdated {
    matches: IMatchEntity[];
}

export interface ISessionEvents {
    StreamUpdated: Subject<number>;
    FileRead: Subject<void>;
    SearchUpdated: Subject<ISearchUpdated>;
    SearchMapUpdated: Subject<string>;
    MapUpdated: Subject<IEventMapUpdated>;
    IndexedMapUpdated: Subject<IEventIndexedMapUpdated>;
    MatchesUpdated: Subject<IEventMatchesUpdated>;
    Progress: Subject<IProgressEvent>;
    SessionError: Subject<IError>;
    OperationError: Subject<IErrorEvent>;
    SessionDestroyed: Subject<void>;
    OperationStarted: Subject<string>;
    OperationDone: Subject<IOperationDoneEvent>;
}

interface ISessionEventsSignatures {
    StreamUpdated: 'StreamUpdated';
    FileRead: 'FileRead';
    SearchUpdated: 'SearchUpdated';
    SearchMapUpdated: 'SearchMapUpdated';
    MapUpdated: 'MapUpdated';
    IndexedMapUpdated: 'IndexedMapUpdated';
    MatchesUpdated: 'MatchesUpdated';
    Progress: 'Progress';
    SessionError: 'SessionError';
    OperationError: 'OperationError';
    SessionDestroyed: 'SessionDestroyed';
    OperationStarted: 'OperationStarted';
    OperationDone: 'OperationDone';
}

const SessionEventsSignatures: ISessionEventsSignatures = {
    StreamUpdated: 'StreamUpdated',
    FileRead: 'FileRead',
    SearchUpdated: 'SearchUpdated',
    SearchMapUpdated: 'SearchMapUpdated',
    MapUpdated: 'MapUpdated',
    IndexedMapUpdated: 'IndexedMapUpdated',
    MatchesUpdated: 'MatchesUpdated',
    Progress: 'Progress',
    SessionError: 'SessionError',
    OperationError: 'OperationError',
    SessionDestroyed: 'SessionDestroyed',
    OperationStarted: 'OperationStarted',
    OperationDone: 'OperationDone',
};

interface ISessionEventsInterfaces {
    StreamUpdated: { self: 'number' };
    FileRead: { self: null };
    SearchUpdated: { self: 'object'; found: 'number'; stat: typeof Object };
    SearchMapUpdated: { self: ['string', null] };
    MapUpdated: { self: 'object'; map: typeof Array };
    IndexedMapUpdated: { self: 'object'; len: 'number' };
    MatchesUpdated: { self: 'object'; matches: typeof Array };
    Progress: {
        self: 'object';
        uuid: 'string';
        progress: [
            { self: 'object'; total: 'number'; count: 'number' },
            { self: 'object'; type: 'string' },
        ];
    };
    SessionError: { self: 'object'; severity: 'string'; message: 'string'; kind: 'string' };
    OperationError: {
        self: 'object';
        uuid: 'string';
        error: { self: 'object'; severity: 'string'; message: 'string'; kind: 'string' };
    };
    SessionDestroyed: { self: null };
    OperationStarted: { self: 'string' };
    OperationDone: { self: 'object'; uuid: 'string'; result: 'any' };
}

const SessionEventsInterfaces: ISessionEventsInterfaces = {
    StreamUpdated: { self: 'number' },
    FileRead: { self: null },
    SearchUpdated: { self: 'object', found: 'number', stat: Object },
    SearchMapUpdated: { self: ['string', null] },
    MapUpdated: { self: 'object', map: Array },
    IndexedMapUpdated: { self: 'object', len: 'number' },
    MatchesUpdated: { self: 'object', matches: Array },
    Progress: {
        self: 'object',
        uuid: 'string',
        progress: [
            { self: 'object', total: 'number', count: 'number' },
            { self: 'object', type: 'string' },
        ],
    },
    SessionError: { self: 'object', severity: 'string', message: 'string', kind: 'string' },
    OperationError: {
        self: 'object',
        uuid: 'string',
        error: { self: 'object', severity: 'string', message: 'string', kind: 'string' },
    },
    SessionDestroyed: { self: null },
    OperationStarted: { self: 'string' },
    OperationDone: { self: 'object', uuid: 'string', result: 'any' },
};

export class EventProvider extends Computation<
    ISessionEvents,
    ISessionEventsSignatures,
    ISessionEventsInterfaces
> {
    private readonly _events: ISessionEvents = {
        StreamUpdated: new Subject<number>(),
        FileRead: new Subject<void>(),
        SearchUpdated: new Subject<ISearchUpdated>(),
        SearchMapUpdated: new Subject<string>(),
        MapUpdated: new Subject<IEventMapUpdated>(),
        IndexedMapUpdated: new Subject<IEventIndexedMapUpdated>(),
        MatchesUpdated: new Subject<IEventMatchesUpdated>(), // dummy
        Progress: new Subject<IProgressEvent>(),
        SessionError: new Subject<IError>(),
        OperationError: new Subject<IErrorEvent>(),
        SessionDestroyed: new Subject<void>(),
        OperationStarted: new Subject<string>(),
        OperationDone: new Subject<IOperationDoneEvent>(),
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
