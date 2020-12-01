import * as Logs from '../util/logging';

import ServiceProduction from '../services/service.production';

import { RustChannelRequiered } from './native.channel.required';
import { ERustEmitterEvents, RustSessionChannelNoType, TEventEmitter, TCanceler } from './native';
import { IFilter, IMatchEntity } from '../interfaces/index';
import { RustChannelConstructorImpl } from './native';
import { IGeneralError } from '../interfaces/errors';
import { CancelablePromise } from '../util/promise';
import { EFileOptionsRequirements, TFileOptions } from '../api/session.stream.assign.computation';
import { IFileToBeMerged } from '../api/session.stream.merge.computation';
import {
    IDetectOptions,
    IDetectDTFormatResult,
} from '../api/session.stream.timeformat.detect.computation';
import {
    IExtractOptions,
    IExtractDTFormatResult,
} from '../api/session.stream.timeformat.extract.computation';
import { IExportOptions } from '../api/session.stream.export.computation';

// Create abstract class to declare available methods
export abstract class RustSessionChannel extends RustChannelRequiered {
    /**
     * Returns chunk of stream/session file.
     * @param start { number } row number of range's start
     * @param len { number } length of the chunk's range
     * @returns { string }
     *
     * @error In case of incorrect range should return { IGeneralError }
     */
    public abstract grabStreamChunk(start: number, len: number): string | IGeneralError;

    /**
     * Returns chunk of stream/session file.
     * @param start { number } row number of range's start
     * @param len { number } length of the chunk's range
     * @returns { string }
     * @error In case of incorrect range should return { IGeneralError }
     */
    public abstract grabSearchChunk(start: number, len: number): string | IGeneralError;

    /**
     * TODO: @return needs interface. It should not be a string
     */
    public abstract grabMatchesChunk(start: number, len: number): string | IGeneralError;

    /**
     * Bind filters with current session. Rust core should break (stop) search (if it wasn't
     * finished before) and start new with defined filters. Search results should be stored
     * in search results file.
     * Search results would be requested with @method grabSearchChunk, which should return
     * whole rows with matches
     *
     * @param filters { IFilter[] } list of filters for session search
     * @returns { void }
     *
     * @error { IGeneralError }
     */
    public abstract setSearch(filters: IFilter[]): IGeneralError | undefined;

    /**
     * Bind filters with current session. Rust core should break (stop) search of matches (if
     * it wasn't finished before) and start new with defined filters.
     * Results of search matches would be requested with @method grabMatchesChunk
     * @param filters { IFilter[] } list of filters for session search
     * @returns { void }
     *
     * @error { IGeneralError }
     */
    public abstract setMatches(filters: IFilter[]): IGeneralError | undefined;

    /**
     * Returns reference to option's type, which should be defined for @method append
     * Would be called each time before @method append
     * @param filename { string } full filename
     * @returns { EFileOptionsRequirements }
     */
    public abstract getFileOptionsRequirements(filename: string): EFileOptionsRequirements;

    /**
     * Returns length (count of rows) of session/stream file
     * @returns { nummber }
     */
    public abstract getStreamLen(): number;

    /**
     * Returns length (count of rows) of search results stream
     * @returns { nummber }
     */
    public abstract getSearchLen(): number;

    /**
     * Returns length (count of rows with matches) of getting matches in stream
     * @returns { nummber }
     */
    public abstract getMatchesLen(): number;

    /**
     * Returns path to socket, which can be used to pass data into session stream
     * @returns { string }
     */
    public abstract getSocketPath(): string;
    
     /**
     * Assigns session with the file. After the file was assigned, @method concat, @method merge cannot be used
     * and should return @error IGeneralError.
     * @param emitter { TEventEmitter } emitter to handle event related to lifecircle of this method only
     * @param filename { string } file, which should be assigned to session
     * @param options { TFileOptions } options to open file
     * @returns { TCanceler | IGeneralError } - callback, which can be called on NodeJS level to cancel
     * async operation. After TCanceler was called, @event destroy of @param emitter would be expected to
     * confirm cancelation.
     */
    public abstract assign(emitter: TEventEmitter, filename: string, options: TFileOptions): TCanceler | IGeneralError;

    /**
     * Concat files and assigns it with session. After this operation, @method assign, @method merge cannot be used
     * and should return @error IGeneralError.
     * @param emitter { TEventEmitter } emitter to handle event related to lifecircle of this method only
     * @param files { string[] } file to be concat
     * @returns { TCanceler | IGeneralError } - callback, which can be called on NodeJS level to cancel
     * async operation. After TCanceler was called, @event destroy of @param emitter would be expected to
     * confirm cancelation.
     */
    public abstract concat(emitter: TEventEmitter, files: string[]): TCanceler | IGeneralError;

    /**
     * Merge files and assigns it with session. After this operation, @method assign, @method concat cannot be used
     * and should return @error IGeneralError.
     * @param emitter { TEventEmitter } emitter to handle event related to lifecircle of this method only
     * @param files { IFileToBeMerged[] } file to be merge
     * @returns { TCanceler | IGeneralError } - callback, which can be called on NodeJS level to cancel
     * async operation. After TCanceler was called, @event destroy of @param emitter would be expected to
     * confirm cancelation.
     */
    public abstract merge(emitter: TEventEmitter, files: IFileToBeMerged[]): TCanceler | IGeneralError;

    public abstract export(emitter: TEventEmitter, options: IExportOptions): TCanceler | IGeneralError;

    public abstract detect(emitter: TEventEmitter, options: IDetectOptions): TCanceler | IGeneralError;

    public abstract extract(emitter: TEventEmitter, options: IExtractOptions): TCanceler | IGeneralError;

    public abstract search(emitter: TEventEmitter, filters: IFilter[]): TCanceler | IGeneralError;
}

export class RustSessionChannelDebug extends RustSessionChannel {
    private readonly _logger: Logs.Logger = Logs.getLogger(`RustSessionChannelDebug`);
    private readonly _emitter: TEventEmitter;
    private _assigned: boolean = false;

    constructor(emitter: TEventEmitter) {
        super();
        this._logger.debug(`created`);
        this._emitter = emitter;
    }

    public destroy() {
        this._logger.debug(`destroyed`);
    }

    public grabStreamChunk(start: number, len: number): string {
        let output: string = '';
        for (let i = start; i <= start + len; i += 1) {
            output += `output: ${i}\n`;
        }
        return output;
    }

    public grabSearchChunk(start: number, len: number): string {
        let output: string = '';
        for (let i = start; i <= start + len; i += 1) {
            output += `search: ${i}\n`;
        }
        return output;
    }

    public grabMatchesChunk(start: number, len: number): string {
        let output: string = '';
        for (let i = start; i <= len; i += 1) {
            output += `matches: ${i}\n`;
        }
        return output;
    }

    public setSearch(filters: IFilter[]): IGeneralError | undefined {
        return undefined;
    }

    public setMatches(filters: IFilter[]): IGeneralError | undefined {
        return undefined;
    }

    public getFileOptionsRequirements(filename: string): EFileOptionsRequirements {
        return EFileOptionsRequirements.NoOptionsRequired;
    }

    public getStreamLen(): number {
        return this._assigned ? 100000 : 0;
    }

    public getSearchLen(): number {
        return this._assigned ? 10000 : 0;
    }

    public getMatchesLen(): number {
        return this._assigned ? 1000 : 0;
    }

    public getSocketPath(): string {
        return '';
    }

    public assign(emitter: TEventEmitter, filename: string, options: TFileOptions): TCanceler {
        const self = this;
        const events = [
            {
                duration: 150,
                handler: function () {
                    self._emitter(ERustEmitterEvents.stream, {
                        rows: 10000,
                    });
                },
            },
            {
                duration: 150,
                handler: function () {
                    self._emitter(ERustEmitterEvents.stream, {
                        rows: 20000,
                    });
                },
            },
            {
                duration: 150,
                handler: function () {
                    self._emitter(ERustEmitterEvents.stream, {
                        rows: 40000,
                    });
                },
            },
            {
                duration: 150,
                handler: function () {
                    self._emitter(ERustEmitterEvents.stream, {
                        rows: 100000,
                    });
                },
            },
            {
                duration: 250,
                handler: function () {
                    emitter(ERustEmitterEvents.destroyed, undefined);
                },
            },
        ];
        function next(pos: number) {
            const event = events[pos];
            setTimeout(() => {
                event.handler();
                pos += 1;
                if (pos < events.length) {
                    next(pos);
                }
            }, event.duration);
        }
        if (!this._assigned) {
            next(0);
        } else {
            next(events.length - 1);
        }
        this._assigned = true;
        return () => {};
    }

    public concat(emitter: TEventEmitter, files: string[]): TCanceler {
        setTimeout(() => {
            emitter(ERustEmitterEvents.destroyed, undefined);
        }, 500);
        return () => {};
    }

    public merge(emitter: TEventEmitter, files: IFileToBeMerged[]): TCanceler {
        setTimeout(() => {
            emitter(ERustEmitterEvents.destroyed, undefined);
        }, 500);
        return () => {};
    }

    public export(emitter: TEventEmitter, options: IExportOptions): TCanceler {
        setTimeout(() => {
            emitter(ERustEmitterEvents.destroyed, undefined);
        }, 500);
        return () => {};
    }

    public detect(emitter: TEventEmitter, options: IDetectOptions): TCanceler {
        setTimeout(() => {
            emitter(ERustEmitterEvents.destroyed, undefined);
        }, 500);
        return () => {};
    }

    public extract(emitter: TEventEmitter, options: IExtractOptions): TCanceler {
        setTimeout(() => {
            emitter(ERustEmitterEvents.destroyed, undefined);
        }, 500);
        return () => {};
    }

    public search(emitter: TEventEmitter, filters: IFilter[]): TCanceler {
        setTimeout(() => {
            emitter(ERustEmitterEvents.destroyed, undefined);
        }, 500);
        return () => {};
    }
}

let RustSessionChannelDebugConstructor: RustChannelConstructorImpl<RustSessionChannelDebug> = RustSessionChannelDebug;

let RustSessionChannelConstructor: RustChannelConstructorImpl<RustSessionChannel>;

if (ServiceProduction.isProd()) {
    RustSessionChannelConstructor = RustSessionChannelNoType;
} else {
    RustSessionChannelConstructor = RustSessionChannelDebugConstructor;
}

export { RustSessionChannelConstructor };
