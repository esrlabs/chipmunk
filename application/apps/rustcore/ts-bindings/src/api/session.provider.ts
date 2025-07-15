import { Subject } from 'platform/env/subscription';
import { ISearchUpdated } from 'platform/types/filter';
import { Computation } from '../provider/provider';
import { EErrorKind, EErrorSeverity } from '../provider/provider.errors';
import { IMapEntity, IMatchEntity, FilterMatch } from 'platform/types/filter';
import { AttachmentInfo, SessionDescriptor } from 'platform/types/bindings';

import * as protocol from 'protocol';

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

export interface IAttachmentsUpdatedUpdated {
    len: number;
    attachment: AttachmentInfo;
}

export interface SessionDescriptorEvent {
    uuid: string;
    desc: SessionDescriptor;
}

export interface ISessionEvents {
    StreamUpdated: Subject<number>;
    FileRead: Subject<void>;
    SearchUpdated: Subject<ISearchUpdated>;
    SearchValuesUpdated: Subject<Map<number, [number, number]> | null>;
    SearchMapUpdated: Subject<FilterMatch[]>;
    MapUpdated: Subject<IEventMapUpdated>;
    IndexedMapUpdated: Subject<IEventIndexedMapUpdated>;
    MatchesUpdated: Subject<IEventMatchesUpdated>;
    Progress: Subject<IProgressEvent>;
    AttachmentsUpdated: Subject<IAttachmentsUpdatedUpdated>;
    SessionError: Subject<IError>;
    OperationError: Subject<IErrorEvent>;
    SessionDestroyed: Subject<void>;
    SessionDescriptor: Subject<SessionDescriptorEvent>;
    OperationStarted: Subject<string>;
    OperationProcessing: Subject<string>;
    OperationDone: Subject<IOperationDoneEvent>;
}

interface ISessionEventsSignatures {
    StreamUpdated: 'StreamUpdated';
    FileRead: 'FileRead';
    SearchUpdated: 'SearchUpdated';
    SearchValuesUpdated: 'SearchValuesUpdated';
    SearchMapUpdated: 'SearchMapUpdated';
    MapUpdated: 'MapUpdated';
    IndexedMapUpdated: 'IndexedMapUpdated';
    MatchesUpdated: 'MatchesUpdated';
    Progress: 'Progress';
    AttachmentsUpdated: 'AttachmentsUpdated';
    SessionError: 'SessionError';
    OperationError: 'OperationError';
    SessionDestroyed: 'SessionDestroyed';
    OperationStarted: 'OperationStarted';
    SessionDescriptor: 'SessionDescriptor';
    OperationProcessing: 'OperationProcessing';
    OperationDone: 'OperationDone';
}

const SessionEventsSignatures: ISessionEventsSignatures = {
    StreamUpdated: 'StreamUpdated',
    FileRead: 'FileRead',
    SearchUpdated: 'SearchUpdated',
    SearchValuesUpdated: 'SearchValuesUpdated',
    SearchMapUpdated: 'SearchMapUpdated',
    MapUpdated: 'MapUpdated',
    IndexedMapUpdated: 'IndexedMapUpdated',
    MatchesUpdated: 'MatchesUpdated',
    AttachmentsUpdated: 'AttachmentsUpdated',
    Progress: 'Progress',
    SessionError: 'SessionError',
    OperationError: 'OperationError',
    SessionDestroyed: 'SessionDestroyed',
    OperationStarted: 'OperationStarted',
    SessionDescriptor: 'SessionDescriptor',
    OperationProcessing: 'OperationProcessing',
    OperationDone: 'OperationDone',
};

export class EventProvider extends Computation<ISessionEvents, ISessionEventsSignatures> {
    private readonly _events: ISessionEvents = {
        StreamUpdated: new Subject<number>(),
        FileRead: new Subject<void>(),
        SearchUpdated: new Subject<ISearchUpdated>(),
        SearchValuesUpdated: new Subject<Map<number, [number, number]> | null>(),
        SearchMapUpdated: new Subject<FilterMatch[]>(),
        MapUpdated: new Subject<IEventMapUpdated>(),
        IndexedMapUpdated: new Subject<IEventIndexedMapUpdated>(),
        MatchesUpdated: new Subject<IEventMatchesUpdated>(), // dummy
        Progress: new Subject<IProgressEvent>(),
        AttachmentsUpdated: new Subject<IAttachmentsUpdatedUpdated>(),
        SessionError: new Subject<IError>(),
        OperationError: new Subject<IErrorEvent>(),
        SessionDestroyed: new Subject<void>(),
        OperationStarted: new Subject<string>(),
        OperationProcessing: new Subject<string>(),
        SessionDescriptor: new Subject<SessionDescriptorEvent>(),
        OperationDone: new Subject<IOperationDoneEvent>(),
    };

    constructor(uuid: string) {
        super(uuid, protocol.decodeCallbackEvent);
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
}
