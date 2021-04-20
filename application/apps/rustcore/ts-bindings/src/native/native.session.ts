import * as Logs from '../util/logging';

import ServiceProduction from '../services/service.production';
import uuid from '../util/uuid';

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
import { IGeneralError, EErrorSeverity } from '../interfaces/errors';
import { EFileOptionsRequirements, TFileOptions } from '../api/session.stream.assign.executor';
import { IFileToBeMerged } from '../api/session.stream.merge.executor';
import { IDetectOptions } from '../api/session.stream.timeformat.detect.executor';
import { IExportOptions } from '../api/session.stream.export.executor';

export type RustSessionConstructorImpl<T> = new (uuid: string, emitter: TEventEmitter) => T;
export type TCanceler = () => void;

// Create abstract class to declare available methods
export abstract class RustSession extends RustSessionRequiered {
    constructor(
        uuid: string,
        emitter: TEventEmitter,
    ) {
        super();
    }

    public abstract destroy(): void;

    /**
     * Returns chunk of stream/session file.
     * @param start { number } row number of range's start
     * @param len { number } length of the chunk's range
     * @returns { string }
     *
     * @error In case of incorrect range should return { IGeneralError }
     */
    public abstract grabStreamChunk(
        start: number,
        len: number,
    ): IGrabbedElement[] | IGeneralError;

    /**
     * Returns chunk of stream/session file.
     * @param start { number } row number of range's start
     * @param len { number } length of the chunk's range
     * @returns { string }
     * @error In case of incorrect range should return { IGeneralError }
     */
    public abstract grabSearchChunk(
        start: number,
        len: number,
    ): IGrabbedElement[] | IGeneralError;

    /**
     * TODO: @return needs interface. It should not be a string
     */
    public abstract grabMatchesChunk(
        start: number,
        len: number,
    ): string[] | IGeneralError;

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
     * @error { IGeneralError }
     */
    public abstract setFilters(filters: IFilter[]): IGeneralError | string;

    /**
     * Returns a list of filters, which are bound with session
     * @returns { IFilter[] }
     *
     * @error { IGeneralError }
     */
    public abstract getFilters(): IFilter[] | IGeneralError;

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
     * @returns { string | IGeneralError } - callback, which can be called on NodeJS level to cancel
     * async operation. After TCanceler was called, @event destroy of @param emitter would be expected to
     * confirm cancelation.
     */
    public abstract assign(
        filename: string,
        options: TFileOptions,
    ): string | IGeneralError;

    /**
     * Concat files and assigns it with session. After this operation, @method assign, @method merge cannot be used
     * and should return @error IGeneralError.
     * @param emitter { TEventEmitter } emitter to handle event related to lifecircle of this method only
     * @param files { string[] } file to be concat
     * @returns { string | IGeneralError } - callback, which can be called on NodeJS level to cancel
     * async operation. After TCanceler was called, @event destroy of @param emitter would be expected to
     * confirm cancelation.
     */
    public abstract concat(files: string[]): string | IGeneralError;

    /**
     * Merge files and assigns it with session. After this operation, @method assign, @method concat cannot be used
     * and should return @error IGeneralError.
     * @param emitter { TEventEmitter } emitter to handle event related to lifecircle of this method only
     * @param files { IFileToBeMerged[] } file to be merge
     * @returns { string | IGeneralError } - callback, which can be called on NodeJS level to cancel
     * async operation. After TCanceler was called, @event destroy of @param emitter would be expected to
     * confirm cancelation.
     */
    public abstract merge(files: IFileToBeMerged[]): string | IGeneralError;

    public abstract export(options: IExportOptions): string | IGeneralError;

    public abstract detect(options: IDetectOptions): string | IGeneralError;

    /**
     * This operation is sync.
     */
    public abstract extract(
        options: IExtractDTFormatOptions,
    ): IExtractDTFormatResult | IGeneralError;

    public abstract search(filters: IFilter[]): string | IGeneralError;

    public abstract abort(uuid: string): undefined | IGeneralError;
}

export abstract class RustSessionNative {
    public abstract stop(): undefined;

    public abstract start(callback: TEventEmitter): IGeneralError | undefined;

    public abstract assign(filename: string, options: TFileOptions): string;

    public abstract getStreamLen(): number;

    public abstract grab(start: number, len: number): string;

    public abstract grabSearch(start: number, len: number): string;

    public abstract getSearchLen(): number;

    public abstract search(filters: Array<{ value: string, is_regex: boolean, ignore_case: boolean, is_word: boolean, }>): IGeneralError | string;

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

    public grabStreamChunk(start: number, len: number): IGrabbedElement[] | IGeneralError {
        try {
            const result: IGrabbedContent = JSON.parse(this._native.grab(start, len));
            return result.grabbed_elements.map((item: IGrabbedElement) => {
                return {
                    content: item.content === undefined ? (item as any).c : item.content,
                    source_id: item.source_id === undefined ? (item as any).id : item.source_id,
                };
            });
        } catch (e) {
            return {
                severity: EErrorSeverity.error,
                message: this._logger.error(
                    `Fail to call grab(${start}, ${len}) due error: ${e.message}`,
                ),
            };
        }
    }

    public grabSearchChunk(start: number, len: number): IGrabbedElement[] | IGeneralError {
        try {
            const result: IGrabbedContent = JSON.parse(this._native.grabSearch(start, len));
            return result.grabbed_elements.map((item: IGrabbedElement) => {
                return {
                    content: item.content === undefined ? (item as any).c : item.content,
                    source_id: item.source_id === undefined ? (item as any).id : item.source_id,
                    position: item.position === undefined ? (item as any).p : item.position,
                    row: item.row === undefined ? (item as any).r : item.row,
                };
            });
        } catch (e) {
            return {
                severity: EErrorSeverity.error,
                message: this._logger.error(
                    `Fail to call grab(${start}, ${len}) due error: ${e.message}`,
                ),
            };
        }
    }

    public grabMatchesChunk(start: number, len: number): string[] {
        return [];
    }

    public setFilters(filters: IFilter[]): IGeneralError | string {
        return 'not_implemented_yet';
    }

    public getFilters(): IFilter[] {
        return [];
    }

    public setMatches(filters: IFilter[]): IGeneralError | undefined {
        return undefined;
    }

    public getFileOptionsRequirements(filename: string): EFileOptionsRequirements {
        return EFileOptionsRequirements.NoOptionsRequired;
    }

    public getStreamLen(): number {
        return this._native.getStreamLen();
    }

    public getSearchLen(): number {
        return this._native.getSearchLen();
    }

    public getMatchesLen(): number {
        return this._assigned ? 1000 : 0;
    }

    public getSocketPath(): string {
        return '';
    }

    public assign(filename: string, options: TFileOptions): string | IGeneralError {
        return this._native.assign(filename, filename);
    }

    public concat(files: string[]): string | IGeneralError {
        return 'not_implemented_yet';
    }

    public merge(files: IFileToBeMerged[]): string | IGeneralError {
        return 'not_implemented_yet';
    }

    public export(options: IExportOptions): string | IGeneralError {
        return 'not_implemented_yet';
    }

    public detect(options: IDetectOptions): string | IGeneralError {
        return 'not_implemented_yet';
    }

    public extract(options: IExtractDTFormatOptions): IExtractDTFormatResult | IGeneralError {
        return { severity: EErrorSeverity.error, message: 'not_implemented_yet' };
    }

    public search(filters: IFilter[]): string | IGeneralError {
        return this._native.search(filters.map((filter) => {
            return {
                value: filter.filter,
                is_regex: filter.flags.reg,
                ignore_case: filter.flags.cases,
                is_word: filter.flags.word,
            };
        }));
    }

    public abort(uuid: string): undefined | IGeneralError {
        return undefined;
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
