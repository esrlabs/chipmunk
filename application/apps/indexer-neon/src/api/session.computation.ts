import { Computation } from './сomputation';
import { RustSessionChannel } from '../native/index';
import { IMapEntity, IMatchEntity } from '../interfaces/index';

import * as Events from '../util/events';

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

export interface ISessionEvents {
    /**
     * @event stream should be triggered with each update of stream/session file:
     * - new content in stream file
     * - content is removed from stream file (drop stream)
     * @type repeatable
     * @subject { IEventStreamUpdated }
     * @interface IEventStreamUpdated
     *      @param rows - count of rows in updated stream
     */
    stream: Events.Subject<IEventStreamUpdated>,

    /**
     * @event search should be triggered with each update of search result file:
     * - any change of search result file
     * @type repeatable
     * @subject { IEventSearchUpdated }
     * @interface IEventSearchUpdated includes
     *      @param rows - count of rows in updated search result file
     */
    search: Events.Subject<IEventSearchUpdated>,
    
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
    map: Events.Subject<IEventMapUpdated>,

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
    matches: Events.Subject<IEventMatchesUpdated>,

    /**
     * @event error should be triggered only in case of some error on stream
     * @type repeatable
     * @subject { Error }
     */
    error: Events.Subject<Error>,

    /**
     * @event destroyed should be triggered in case of session/stream is destroyed and no more
     * possobility to use API of session. Any attempt to use API of session after this event
     * should throw an error
     * @type once
     */
    destroyed: Events.Subject<void>,

    /**
     * @event done should be triggered as soon as session API is ready to use
     * @type once 
     */
    done: Events.Subject<void>,
}

interface ISessionEventsSignatures {
    stream: 'stream';
    search: 'search';
    map: 'map';
    matches: 'matches';
    error: 'error';
    destroyed: 'destroyed';
    done: 'done';
};

const SessionEventsInterface = {
    stream: { self: 'object', rows: 'number' },
    search: { self: 'object', rows: 'number' },
    map: { self: 'object', map: Array },
    matches: { self: 'object', matches: Array },
    error: { self: Error },
    destroyed: { self: null },
    done: { self: null }
};

export class SessionComputation extends Computation<ISessionEvents> {

    private readonly _events: ISessionEvents = {
        stream: new Events.Subject<IEventStreamUpdated>(),
        search: new Events.Subject<IEventSearchUpdated>(),
        map: new Events.Subject<IEventMapUpdated>(),
        matches: new Events.Subject<IEventMatchesUpdated>(),
        error: new Events.Subject<Error>(),
        destroyed: new Events.Subject<void>(),
        done: new Events.Subject<void>(),
    };

    constructor(channel: RustSessionChannel, uuid: string) {
        super(channel, uuid);
    }

    public getName(): string {
        return 'SessionComputation';
    }

    public getEvents(): ISessionEvents {
        return this._events;
    }

    public getEventsSignatures(): ISessionEventsSignatures {
        return {
            stream: 'stream',
            search: 'search',
            map: 'map',
            matches: 'matches',
            error: 'error',
            destroyed: 'destroyed',
            done: 'done',
        };
    }

    public getEventsInterfaces() {
        return SessionEventsInterface;
    }


}
