import * as Logs from '../util/logging';

import ServiceProduction from '../services/service.production';

import { RustSessionRequiered } from './native.session.required';
import { TEventEmitter } from '../provider/provider.general';
import { RustSessionNoType } from './native';
import {
    IFilter,
    IGrabbedContent,
    IGrabbedElement,
    IExtractDTFormatResult,
    IExtractDTFormatOptions,
} from '../interfaces/index';
import { getNativeModule } from './native';
import { EFileOptionsRequirements, TFileOptions } from '../api/session.stream.assign.executor';
import { IFileToBeMerged } from '../api/session.stream.merge.executor';
import { IDetectOptions } from '../api/session.stream.timeformat.detect.executor';
import { IExportOptions } from '../api/session.stream.export.executor';
import { Type, Source, NativeError } from '../interfaces/errors';

export type RustSessionConstructorImpl<T> = new (uuid: string, emitter: TEventEmitter) => T;
export type TCanceler = () => void;

// Create abstract class to declare available methods
export abstract class RustSession extends RustSessionRequiered {
    constructor(uuid: string, emitter: TEventEmitter) {
        super();
    }

    public abstract destroy(): void;

    /**
     * Returns chunk of stream/session file.
     * @param start { number } row number of range's start
     * @param len { number } length of the chunk's range
     * @returns { string }
     *
     * @error In case of incorrect range should return { NativeError }
     */
    public abstract grabStreamChunk(start: number, len: number): IGrabbedElement[] | NativeError;

    /**
     * Returns chunk of stream/session file.
     * @param start { number } row number of range's start
     * @param len { number } length of the chunk's range
     * @returns { string }
     * @error In case of incorrect range should return { NativeError }
     */
    public abstract grabSearchChunk(start: number, len: number): IGrabbedElement[] | NativeError;

    /**
     * TODO: @return needs interface. It should not be a string
     */
    public abstract grabMatchesChunk(start: number, len: number): string[] | NativeError;

    public abstract id(): string;

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
     * @error { NativeError }
     */
    public abstract setFilters(filters: IFilter[]): NativeError | string;

    /**
     * Returns a list of filters, which are bound with session
     * @returns { IFilter[] }
     *
     * @error { NativeError }
     */
    public abstract getFilters(): IFilter[] | NativeError;

    /**
     * Bind filters with current session. Rust core should break (stop) search of matches (if
     * it wasn't finished before) and start new with defined filters.
     * Results of search matches would be requested with @method grabMatchesChunk
     * @param filters { IFilter[] } list of filters for session search
     * @returns { void }
     *
     * @error { NativeError }
     */
    public abstract setMatches(filters: IFilter[]): NativeError | undefined;

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
    public abstract getStreamLen(): number | NativeError;

    /**
     * Returns length (count of rows) of search results stream
     * @returns { nummber }
     */
    public abstract getSearchLen(): number | NativeError;

    /**
     * Returns length (count of rows with matches) of getting matches in stream
     * @returns { nummber }
     */
    public abstract getMatchesLen(): number | NativeError;

    /**
     * Returns path to socket, which can be used to pass data into session stream
     * @returns { string }
     */
    public abstract getSocketPath(): string | NativeError;

    /**
     * Assigns session with the file. After the file was assigned, @method concat, @method merge cannot be used
     * and should return @error NativeError.
     * @param emitter { TEventEmitter } emitter to handle event related to lifecircle of this method only
     * @param filename { string } file, which should be assigned to session
     * @param options { TFileOptions } options to open file
     * @returns { string | NativeError } - callback, which can be called on NodeJS level to cancel
     * async operation. After TCanceler was called, @event destroy of @param emitter would be expected to
     * confirm cancelation.
     */
    public abstract assign(filename: string, options: TFileOptions): string | NativeError;

    /**
     * Concat files and assigns it with session. After this operation, @method assign, @method merge cannot be used
     * and should return @error NativeError.
     * @param emitter { TEventEmitter } emitter to handle event related to lifecircle of this method only
     * @param files { string[] } file to be concat
     * @returns { string | NativeError } - callback, which can be called on NodeJS level to cancel
     * async operation. After TCanceler was called, @event destroy of @param emitter would be expected to
     * confirm cancelation.
     */
    public abstract concat(files: string[]): string | NativeError;

    /**
     * Merge files and assigns it with session. After this operation, @method assign, @method concat cannot be used
     * and should return @error NativeError.
     * @param emitter { TEventEmitter } emitter to handle event related to lifecircle of this method only
     * @param files { IFileToBeMerged[] } file to be merge
     * @returns { string | NativeError } - callback, which can be called on NodeJS level to cancel
     * async operation. After TCanceler was called, @event destroy of @param emitter would be expected to
     * confirm cancelation.
     */
    public abstract merge(files: IFileToBeMerged[]): string | NativeError;

    public abstract export(options: IExportOptions): string | NativeError;

    public abstract detect(options: IDetectOptions): string | NativeError;

    /**
     * This operation is sync.
     */
    public abstract extract(options: IExtractDTFormatOptions): IExtractDTFormatResult | NativeError;

    public abstract search(filters: IFilter[]): string | NativeError;

    public abstract getMap(datasetLength: number, from?: number, to?: number): NativeError | string;

    public abstract getNearestTo(
        positionInStream: number,
    ): NativeError | { index: number; position: number } | undefined;

    public abstract abort(uuid: string): undefined | NativeError;
}

export abstract class RustSessionNative {
    public abstract stop(): undefined;

    public abstract start(callback: TEventEmitter): undefined;

    public abstract assign(filename: string, options: TFileOptions): string;

    public abstract getStreamLen(): number;

    public abstract grab(start: number, len: number): string;

    public abstract grabSearch(start: number, len: number): string;

    public abstract getSearchLen(): number;

    public abstract applySearchFilters(
        filters: Array<{
            value: string;
            is_regex: boolean;
            ignore_case: boolean;
            is_word: boolean;
        }>,
    ): string;

    public abstract getMap(datasetLength: number, from?: number, to?: number): string;

    public abstract getNearestTo(positionInStream: number): number[] | null;
}

export class RustSessionDebug extends RustSession {
    private readonly _logger: Logs.Logger = Logs.getLogger(`RustSessionDebug`);
    private readonly _uuid: string;
    private readonly _native: RustSessionNative;
    private _assigned: boolean = false;
    private _emitter: TEventEmitter;

    constructor(uuid: string, emitter: TEventEmitter) {
        super(uuid, emitter);
        this._native = new (getNativeModule().RustSession)(uuid) as RustSessionNative;
        this._native.start(emitter);
        this._logger.debug(`Rust native session is created`);
        this._uuid = uuid;
        this._emitter = emitter;
    }

    public destroy(): void {
        this._native.stop();
        this._logger.debug(`destroyed`);
    }

    public id(): string {
        return this._uuid;
    }

    public grabStreamChunk(start: number, len: number): IGrabbedElement[] | NativeError {
        const grabbed = (() => {
            try {
                return this._native.grab(start, len);
            } catch (err) {
                return new NativeError(err, Type.GrabbingContent, Source.GrabStreamChunk);
            }
        })();
        if (grabbed instanceof NativeError) {
            return grabbed;
        }
        try {
            const result: IGrabbedContent = JSON.parse(grabbed);
            return result.grabbed_elements.map((item: IGrabbedElement) => {
                return {
                    content: item.content === undefined ? (item as any).c : item.content,
                    source_id: item.source_id === undefined ? (item as any).id : item.source_id,
                };
            });
        } catch (err) {
            return new NativeError(new Error(
                this._logger.error(`Fail to call grab(${start}, ${len}) due error: ${err.message}`),
            ), Type.ParsingContentChunk, Source.GrabStreamChunk);
        }
    }

    public grabSearchChunk(start: number, len: number): IGrabbedElement[] | NativeError {
        const grabbed = (() => {
            try {
                return this._native.grabSearch(start, len);
            } catch (err) {
                return new NativeError(err, Type.GrabbingSearch, Source.GrabSearchChunk);
            }
        })();
        if (grabbed instanceof NativeError) {
            return grabbed;
        }
        try {
            const result: IGrabbedContent = JSON.parse(grabbed);
            return result.grabbed_elements.map((item: IGrabbedElement) => {
                return {
                    content: item.content === undefined ? (item as any).c : item.content,
                    source_id: item.source_id === undefined ? (item as any).id : item.source_id,
                    position: item.position === undefined ? (item as any).p : item.position,
                    row: item.row === undefined ? (item as any).r : item.row,
                };
            });
        } catch (err) {
            return new NativeError(new Error(
                this._logger.error(`Fail to call grab(${start}, ${len}) due error: ${err.message}`),
            ), Type.ParsingSearchChunk, Source.GrabSearchChunk);
        }
    }

    public grabMatchesChunk(start: number, len: number): string[] | NativeError {
        return new NativeError(new Error('Not implemented yet'), Type.Other, Source.GetSocketPath);
    }

    public setFilters(filters: IFilter[]): NativeError | string {
        return new NativeError(new Error('Not implemented yet'), Type.Other, Source.GetSocketPath);
    }

    public getFilters(): IFilter[] | NativeError {
        return new NativeError(new Error('Not implemented yet'), Type.Other, Source.GetFilters);
    }

    public setMatches(filters: IFilter[]): NativeError | undefined {
        return new NativeError(new Error('Not implemented yet'), Type.Other, Source.GetSocketPath);
    }

    public getFileOptionsRequirements(filename: string): EFileOptionsRequirements {
        return EFileOptionsRequirements.NoOptionsRequired;
    }

    public getStreamLen(): number | NativeError {
        try {
            return this._native.getStreamLen();
        } catch (err) {
            return new NativeError(err, Type.Other, Source.GetStreamLen);
        }
    }

    public getSearchLen(): number | NativeError {
        try {
            return this._native.getSearchLen();
        } catch (err) {
            return new NativeError(err, Type.Other, Source.GetSearchLen);
        }
    }

    public getMatchesLen(): number | NativeError {
        return this._assigned ? 1000 : 0;
    }

    public getSocketPath(): string | NativeError {
        return new NativeError(new Error('Not implemented yet'), Type.Other, Source.GetSocketPath);
    }

    public assign(filename: string, options: TFileOptions): string | NativeError {
        try {
            return this._native.assign(filename, filename);
        } catch (err) {
            return new NativeError(err, Type.Other, Source.Assign);
        }
    }

    public concat(files: string[]): string | NativeError {
        return new NativeError(new Error('Not implemented yet'), Type.Other, Source.Concat);
    }

    public merge(files: IFileToBeMerged[]): string | NativeError {
        return new NativeError(new Error('Not implemented yet'), Type.Other, Source.Merge);
    }

    public export(options: IExportOptions): string | NativeError {
        return new NativeError(new Error('Not implemented yet'), Type.Other, Source.Export);
    }

    public detect(options: IDetectOptions): string | NativeError {
        return new NativeError(new Error('Not implemented yet'), Type.Other, Source.Detect);
    }

    public extract(options: IExtractDTFormatOptions): IExtractDTFormatResult | NativeError {
        return new NativeError(new Error('Not implemented yet'), Type.Other, Source.Extract);
    }

    public search(filters: IFilter[]): string | NativeError {
        try {
            return this._native.applySearchFilters(
                filters.map((filter) => {
                    return {
                        value: filter.filter,
                        is_regex: filter.flags.reg,
                        ignore_case: !filter.flags.cases,
                        is_word: filter.flags.word,
                    };
                }),
            );
        } catch (err) {
            return new NativeError(err, Type.Other, Source.Search);
        }
    }

    public getMap(datasetLength: number, from?: number, to?: number): NativeError | string {
        try {
            if (from === undefined || to === undefined) {
                return this._native.getMap(datasetLength);
            } else {
                return this._native.getMap(datasetLength, from, to);
            }
        } catch (err) {
            return new NativeError(err, Type.Other, Source.GetMap);
        }
    }

    public getNearestTo(
        positionInStream: number,
    ): NativeError | { index: number; position: number } | undefined {
        const nearest = (() => {
            try {
                return this._native.getNearestTo(positionInStream)
            } catch (err) {
                return new NativeError(err, Type.Other, Source.GetNearestTo);
            }
        })();
        if (nearest instanceof NativeError) {
            return nearest;
        }
        if (nearest instanceof Array && nearest.length !== 2) {
            return new NativeError(
                new Error(`Invalid format of data: ${nearest}. Expecting an array (size 2): [number, number]`),
                Type.InvalidOutput,
                Source.GetNearestTo,
            );
        } else if (nearest === null) {
            return undefined;
        } else if (nearest instanceof Array && nearest.length === 2) {
            return { index: nearest[0], position: nearest[1] };
        }
    }

    public abort(uuid: string): undefined | NativeError {
        return new NativeError(new Error('Not implemented yet'), Type.Other, Source.Export);
    }
}

let RustSessionDebugConstructor: RustSessionConstructorImpl<RustSessionDebug> = RustSessionDebug;

let RustSessionConstructor: RustSessionConstructorImpl<RustSession>;

if (ServiceProduction.isProd()) {
    RustSessionConstructor = RustSessionNoType;
} else {
    RustSessionConstructor = RustSessionDebugConstructor;
}

export { RustSessionConstructor };
