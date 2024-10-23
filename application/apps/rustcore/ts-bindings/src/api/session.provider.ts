import { Subject } from 'platform/env/subscription';
import { ISearchUpdated } from 'platform/types/filter';
import { Computation } from '../provider/provider';
import { EErrorKind, EErrorSeverity } from '../provider/provider.errors';
import { IMapEntity, IMatchEntity, IValuesMinMaxMap } from 'platform/types/filter';
import { IAttachment } from 'platform/types/content';

import * as convertor from '../util/convertor';

export interface IProgressEvent {
    uuid: string;
    event: convertor.ProgressEventTy;
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
    attachment: IAttachment;
}

export interface ISessionEvents {
    StreamUpdated: Subject<number>;
    FileRead: Subject<void>;
    SearchUpdated: Subject<ISearchUpdated>;
    SearchValuesUpdated: Subject<IValuesMinMaxMap | null>;
    SearchMapUpdated: Subject<string>;
    IndexedMapUpdated: Subject<IEventIndexedMapUpdated>;
    Progress: Subject<IProgressEvent>;
    AttachmentsUpdated: Subject<IAttachmentsUpdatedUpdated>;
    SessionError: Subject<IError>;
    OperationError: Subject<IErrorEvent>;
    SessionDestroyed: Subject<void>;
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
    IndexedMapUpdated: 'IndexedMapUpdated';
    Progress: 'Progress';
    AttachmentsUpdated: 'AttachmentsUpdated';
    SessionError: 'SessionError';
    OperationError: 'OperationError';
    SessionDestroyed: 'SessionDestroyed';
    OperationStarted: 'OperationStarted';
    OperationProcessing: 'OperationProcessing';
    OperationDone: 'OperationDone';
}

const SessionEventsSignatures: ISessionEventsSignatures = {
    StreamUpdated: 'StreamUpdated',
    FileRead: 'FileRead',
    SearchUpdated: 'SearchUpdated',
    SearchValuesUpdated: 'SearchValuesUpdated',
    SearchMapUpdated: 'SearchMapUpdated',
    IndexedMapUpdated: 'IndexedMapUpdated',
    AttachmentsUpdated: 'AttachmentsUpdated',
    Progress: 'Progress',
    SessionError: 'SessionError',
    OperationError: 'OperationError',
    SessionDestroyed: 'SessionDestroyed',
    OperationStarted: 'OperationStarted',
    OperationProcessing: 'OperationProcessing',
    OperationDone: 'OperationDone',
};

interface ISessionEventsInterfaces {
    StreamUpdated: { self: 'number' };
    FileRead: { self: null };
    SearchUpdated: { self: 'object'; found: 'number'; stat: typeof Object };
    SearchValuesUpdated: { self: ['object', null] };
    SearchMapUpdated: { self: ['string', null] };
    IndexedMapUpdated: { self: 'object'; len: 'number' };
    Progress: {
        self: 'object';
        uuid: 'string';
        event: [
            {
                self: 'object';
                progress: { self: 'object'; total: 'number'; count: 'number'; state: 'string' };
            },
            { self: 'object'; stopped: { self: 'object'; type: 'boolean' } },
            {
                self: 'object';
                notification: {
                    self: 'object';
                    severity: 'number';
                    line: 'number';
                    content: 'string';
                };
            },
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
    OperationProcessing: { self: 'string' };
    OperationDone: { self: 'object'; uuid: 'string'; result: 'any' };
}

const SessionEventsInterfaces: ISessionEventsInterfaces = {
    StreamUpdated: { self: 'number' },
    FileRead: { self: null },
    SearchUpdated: { self: 'object', found: 'number', stat: Object },
    SearchValuesUpdated: { self: ['object', null] },
    SearchMapUpdated: { self: ['string', null] },
    IndexedMapUpdated: { self: 'object', len: 'number' },
    Progress: {
        self: 'object',
        uuid: 'string',
        event: [
            {
                self: 'object',
                progress: { self: 'object', total: 'number', count: 'number', state: 'string' },
            },
            { self: 'object', stopped: { self: 'object', type: 'boolean' } },
            {
                self: 'object',
                notification: {
                    self: 'object',
                    severity: 'number',
                    line: 'number',
                    content: 'string',
                },
            },
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
        SearchValuesUpdated: new Subject<IValuesMinMaxMap | null>(),
        SearchMapUpdated: new Subject<string>(),
        IndexedMapUpdated: new Subject<IEventIndexedMapUpdated>(),
        Progress: new Subject<IProgressEvent>(), // This even isn't used. No listeners on ts side and never fires on rs side
        AttachmentsUpdated: new Subject<IAttachmentsUpdatedUpdated>(),
        SessionError: new Subject<IError>(),
        OperationError: new Subject<IErrorEvent>(),
        SessionDestroyed: new Subject<void>(),
        OperationStarted: new Subject<string>(),
        OperationProcessing: new Subject<string>(),
        OperationDone: new Subject<IOperationDoneEvent>(),
    };

    private readonly _convertors: ISessionEventsConvertors = {};

    constructor(uuid: string) {
        super(uuid, convertor.decodeCallbackEvent);
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
