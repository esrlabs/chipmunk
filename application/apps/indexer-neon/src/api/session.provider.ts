import * as Events from '../util/events';

import ServiceProduction from '../services/service.production';

import { Computation } from '../provider/provider';
import { IMapEntity, IMatchEntity } from '../interfaces/index';
import { ERustEmitterEvents } from '../native/native';

import { IProviderError } from '../provider/provider.errors';

export interface IProgressState {
    total: number;
    done: number;
}

export interface IProgressEvent {
    uuid: string;
    Progress: IProgressState;
}

export interface ISessionEvents {

    StreamUpdated: Events.Subject<number>;
    SearchUpdated: Events.Subject<number>;
    Progress: Events.Subject<IProgressEvent>;
    SessionError: Events.Subject<Error>;
    OperationError: Events.Subject<Error>;
    SessionDestroyed: Events.Subject<void>;
    OperationDone: Events.Subject<string>;
}

interface ISessionEventsSignatures  {
    StreamUpdated: 'StreamUpdated';
    SearchUpdated: 'SearchUpdated';
    Progress: 'Progress';
    SessionError: 'SessionError',
    OperationError: 'OperationError',
    SessionDestroyed: 'SessionDestroyed';
    OperationDone: 'OperationDone';
}

const SessionEventsSignatures: ISessionEventsSignatures = {
    StreamUpdated: 'StreamUpdated',
    SearchUpdated: 'SearchUpdated',
    Progress: 'Progress',
    SessionError: 'SessionError',
    OperationError: 'OperationError',
    SessionDestroyed: 'SessionDestroyed',
    OperationDone: 'OperationDone',
};

interface ISessionEventsInterfaces  {
    StreamUpdated: { self: 'number' };
    SearchUpdated: { self: 'number' };
    Progress: { self: 'object', uuid: 'string', progress: { self: 'object', total: 'number', done: 'number' } };
    SessionError: { self: 'object', severity: 'string', message: 'string' };
    OperationError: { self: 'object', severity: 'string', message: 'string' };
    SessionDestroyed: { self: null };
    OperationDone: { self: 'string' }
}

const SessionEventsInterfaces: ISessionEventsInterfaces = {
    StreamUpdated: { self: 'number' },
    SearchUpdated: { self: 'number' },
    Progress: { self: 'object', uuid: 'string', progress: { self: 'object', total: 'number', done: 'number' } },
    SessionError: { self: 'object', severity: 'string', message: 'string' },
    OperationError: { self: 'object', severity: 'string', message: 'string' },
    SessionDestroyed: { self: null },
    OperationDone: { self: 'string' }
};

export class EventProvider extends Computation<ISessionEvents> {

    private readonly _events: ISessionEvents = {
        StreamUpdated: new Events.Subject<number>(),
        SearchUpdated: new Events.Subject<number>(),
        Progress: new Events.Subject<IProgressEvent>(),
        SessionError: new Events.Subject<Error>(),
        OperationError: new Events.Subject<Error>(),
        SessionDestroyed: new Events.Subject<void>(),
        OperationDone: new Events.Subject<string>(),
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
