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

export interface ISessionEventsConvertors {}

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

interface ISessionEventsInterfaces {
    StreamUpdated: { self: 'number' };
    FileRead: { self: null };
    SearchUpdated: { self: 'object'; found: 'number'; stat: typeof Map };
    SearchValuesUpdated: { self: ['object', null] };
    SearchMapUpdated: { self: [typeof Array, null] };
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
    AttachmentsUpdated: { self: 'object'; len: 'number'; attachment: typeof Object };
    SessionError: { self: 'object'; severity: 'string'; message: 'string'; kind: 'string' };
    OperationError: {
        self: 'object';
        uuid: 'string';
        error: { self: 'object'; severity: 'string'; message: 'string'; kind: 'string' };
    };
    SessionDestroyed: { self: null };
    OperationStarted: { self: 'string' };
    SessionDescriptor: {
        self: 'object';
        uuid: 'string';
        desc: {
            self: 'object';
            parser: 'object';
            source: 'object';
            s_desc: ['string', null];
            p_desc: ['string', null];
        };
    };
    OperationProcessing: { self: 'string' };
    OperationDone: { self: 'object'; uuid: 'string'; result: 'any' };
}

const SessionEventsInterfaces: ISessionEventsInterfaces = {
    StreamUpdated: { self: 'number' },
    FileRead: { self: null },
    SearchUpdated: { self: 'object', found: 'number', stat: Map },
    SearchValuesUpdated: { self: ['object', null] },
    SearchMapUpdated: { self: [Array, null] },
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
    AttachmentsUpdated: { self: 'object', len: 'number', attachment: Object },
    SessionError: { self: 'object', severity: 'string', message: 'string', kind: 'string' },
    OperationError: {
        self: 'object',
        uuid: 'string',
        error: { self: 'object', severity: 'string', message: 'string', kind: 'string' },
    },
    SessionDestroyed: { self: null },
    OperationStarted: { self: 'string' },
    SessionDescriptor: {
        self: 'object',
        uuid: 'string',
        desc: {
            self: 'object',
            parser: 'object',
            source: 'object',
            s_desc: ['string', null],
            p_desc: ['string', null],
        },
    },
    OperationProcessing: { self: 'string' },
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

    private readonly _convertors: ISessionEventsConvertors = {};

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

    public getEventsInterfaces(): ISessionEventsInterfaces {
        return SessionEventsInterfaces;
    }

    public getConvertor<T, O>(event: keyof ISessionEventsSignatures, data: T): T | O | Error {
        const convertors = this._convertors as unknown as { [key: string]: (data: T) => T | O };
        if (typeof convertors[event] !== 'function') {
            return data;
        } else {
            return convertors[event](data);
        }
    }
}
