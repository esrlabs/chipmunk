import { Computation } from './сomputation';
import { RustSessionChannel } from '../native/index';
import { IMapEntity, IMatchEntity } from '../interfaces/index';
import {
    IEventsInterfaces,
    EventsInterfaces,
    EventsSignatures,
    IEventsSignatures,
    IEvents,
    IError,
} from '../interfaces/computation.minimal';
import * as Events from '../util/events';

export { IError };

export interface IEventStreamUpdated {
    rows: number;
}

export interface IEventSearchUpdated {
    rows: number;
}

export interface IEventMapUpdated {
    map: IMapEntity[];
}

export interface IEventMatchesUpdated {
    matches: IMatchEntity[];
}

export interface ISessionEvents extends IEvents {
    /**
     * @event stream should be triggered with each update of stream/session file:
     * - new content in stream file
     * - content is removed from stream file (drop stream)
     * @type repeatable
     * @subject { IEventStreamUpdated }
     * @interface IEventStreamUpdated
     *      @param rows - count of rows in updated stream
     */
    stream: Events.Subject<IEventStreamUpdated>;

    /**
     * @event search should be triggered with each update of search result file:
     * - any change of search result file
     * @type repeatable
     * @subject { IEventSearchUpdated }
     * @interface IEventSearchUpdated includes
     *      @param rows - count of rows in updated search result file
     */
    search: Events.Subject<IEventSearchUpdated>;

    /**
     * @event map should be triggered as soon as map of search results updated.
     * Map of search results includes information about matches for each filters (which was
     * applyed on search.
     * @type repeatable
     * @subject { IEventMapUpdated }
     * @interface IEventMapUpdated
     *      @param matches {IMapEntity[]} - an array with matches data
     * @interface IMapEntity includes next fields:
     *      @param filter {string} - value of filter
     *      @param rows {number[]} - an array with rows number, which have match for @param filter
     */
    map: Events.Subject<IEventMapUpdated>;

    /**
     * @event matches should be triggered as soon as matches list are updated. This event isn't
     * related to regular search.
     * @type repeatable
     * @subject { IEventMatchesUpdated }
     * @interface IEventMatchesUpdated
     *      @param matches {IMatchEntity[]} - an array with matches data
     * @interface IMatchEntity includes next fields:
     * 		@param filter { string } - string representation of filter
     * 		@param match { string } - match.
     * 		@param row { number } - number or row (in stream file, which has match)
     */
    matches: Events.Subject<IEventMatchesUpdated>;
    /**
     * @event ready should be triggered as soon as session API is ready to use
     * @type once
     */
    ready: Events.Subject<void>;
}

interface ISessionEventsSignatures extends IEventsSignatures {
    stream: 'stream';
    search: 'search';
    map: 'map';
    matches: 'matches';
    ready: 'ready';
}

const SessionEventsSignatures = Object.assign(
    {
        stream: 'stream',
        search: 'search',
        map: 'map',
        matches: 'matches',
        ready: 'ready',
    },
    EventsSignatures,
) as ISessionEventsSignatures;

interface ISessionEventsInterfaces extends IEventsInterfaces {
    stream: { self: 'object'; rows: 'number' };
    search: { self: 'object'; rows: 'number' };
    map: { self: 'object'; map: typeof Array };
    matches: { self: 'object'; matches: typeof Array };
    ready: { self: null };
}

const SessionEventsInterfaces = Object.assign(
    {
        stream: { self: 'object', rows: 'number' },
        search: { self: 'object', rows: 'number' },
        map: { self: 'object', map: Array },
        matches: { self: 'object', matches: Array },
        ready: { self: null },
    },
    EventsInterfaces,
) as ISessionEventsInterfaces;

export class SessionComputation extends Computation<ISessionEvents> {
    private readonly _events: ISessionEvents = {
        stream: new Events.Subject<IEventStreamUpdated>(),
        search: new Events.Subject<IEventSearchUpdated>(),
        map: new Events.Subject<IEventMapUpdated>(),
        matches: new Events.Subject<IEventMatchesUpdated>(),
        error: new Events.Subject<IError>(),
        destroyed: new Events.Subject<void>(),
        ready: new Events.Subject<void>(),
    };

    constructor(uuid: string) {
        super(uuid);
    }

    public getName(): string {
        return 'SessionComputation';
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
