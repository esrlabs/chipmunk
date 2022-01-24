import * as Logs from '../util/logging';

import ServiceProduction from '../services/service.production';

import { RustSessionRequiered } from './native.session.required';
import { TEventEmitter } from '../provider/provider.general';
import { Computation } from '../provider/provider';
import { RustSessionNoType } from './native';
import {
    IFilter,
    IGrabbedContent,
    IGrabbedElement,
    IExtractDTFormatResult,
    IExtractDTFormatOptions,
    IConcatFile,
    IFileMergeOptions,
} from '../interfaces/index';
import { getNativeModule } from './native';
import { EFileOptionsRequirements, TFileOptions } from '../api/session.stream.assign.executor';
import { IDetectOptions } from '../api/session.stream.timeformat.detect.executor';
import { IExportOptions } from '../api/session.stream.export.executor';
import { Type, Source, NativeError } from '../interfaces/errors';
import { v4 as uuidv4 } from 'uuid';

export type RustSessionConstructorImpl<T> = new (
    uuid: string,
    provider: Computation<any, any, any>,
    cb: (err: Error | undefined) => void,
) => T;
export type TCanceler = () => void;

// Create abstract class to declare available methods
export abstract class RustSession extends RustSessionRequiered {
    constructor(uuid: string, provider: Computation<any, any, any>) {
        super();
    }

    public abstract destroy(): Promise<void>;

    /**
     * Returns chunk of stream/session file.
     * @param start { number } row number of range's start
     * @param len { number } length of the chunk's range
     * @returns { string }
     *
     * @error In case of incorrect range should return { NativeError }
     */
    public abstract grabStreamChunk(start: number, len: number): Promise<IGrabbedElement[]>;

    /**
     * Returns chunk of stream/session file.
     * @param start { number } row number of range's start
     * @param len { number } length of the chunk's range
     * @returns { string }
     * @error In case of incorrect range should return { NativeError }
     */
    public abstract grabSearchChunk(start: number, len: number): Promise<IGrabbedElement[]>;

    /**
     * TODO: @return needs interface. It should not be a string
     */
    public abstract grabMatchesChunk(start: number, len: number): string[] | NativeError;

    public abstract getUuid(): string;

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
    public abstract getStreamLen(): Promise<number>;

    /**
     * Returns length (count of rows) of search results stream
     * @returns { nummber }
     */
    public abstract getSearchLen(): Promise<number>;

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
    public abstract assign(
        filename: string,
        options: TFileOptions,
        operationUuid: string,
    ): Promise<void>;

    /**
     * Concat files and assigns it with session. After this operation, @method assign, @method merge cannot be used
     * and should return @error NativeError.
     * @param emitter { TEventEmitter } emitter to handle event related to lifecircle of this method only
     * @param files { string[] } file to be concat
     * @returns { string | NativeError } - callback, which can be called on NodeJS level to cancel
     * async operation. After TCanceler was called, @event destroy of @param emitter would be expected to
     * confirm cancelation.
     */
    public abstract concat(
        files: IConcatFile[],
        append: boolean,
        operationUuid: string,
    ): Promise<void>;

    /**
     * Merge files and assigns it with session. After this operation, @method assign, @method concat cannot be used
     * and should return @error NativeError.
     * @param emitter { TEventEmitter } emitter to handle event related to lifecircle of this method only
     * @param files { IFileToBeMerged[] } file to be merge
     * @returns { string | NativeError } - callback, which can be called on NodeJS level to cancel
     * async operation. After TCanceler was called, @event destroy of @param emitter would be expected to
     * confirm cancelation.
     */
    public abstract merge(
        files: IFileMergeOptions[],
        append: boolean,
        operationUuid: string,
    ): Promise<void>;

    public abstract export(options: IExportOptions): string | NativeError;

    public abstract detect(options: IDetectOptions): string | NativeError;

    /**
     * This operation is sync.
     */
    public abstract extract(options: IExtractDTFormatOptions): IExtractDTFormatResult | NativeError;

    public abstract search(filters: IFilter[], operationUuid: string): Promise<void>;

    public abstract extractMatchesValues(filters: IFilter[], operationUuid: string): Promise<void>;

    public abstract getMap(
        operationUuid: string,
        datasetLength: number,
        from?: number,
        to?: number,
    ): Promise<string>;

    public abstract getNearestTo(
        operationUuid: string,
        positionInStream: number,
    ): Promise<{ index: number; position: number } | undefined>;

    public abstract abort(
        selfOperationUuid: string,
        targetOperationUuid: string,
    ): boolean | NativeError;

    public abstract setDebug(debug: boolean): Promise<void>;

    public abstract getOperationsStat(): Promise<string>;

    public abstract sleep(operationUuid: string, duration: number): Promise<void>;

    // public abstract sleepUnblock(duration: number): Promise<void>;
}

export abstract class RustSessionNative {
    public abstract stop(operationUuid: string): Promise<void>;

    public abstract init(callback: TEventEmitter): Promise<void>;

    public abstract getUuid(): string;

    public abstract assign(
        filename: string,
        options: TFileOptions,
        operationUuid: string,
    ): Promise<void>;

    public abstract concat(
        files: IConcatFile[],
        append: boolean,
        operationUuid: string,
    ): Promise<void>;

    public abstract merge(
        files: IFileMergeOptions[],
        append: boolean,
        operationUuid: string,
    ): Promise<void>;

    public abstract getStreamLen(): Promise<number>;

    public abstract grab(start: number, len: number): Promise<string>;

    public abstract grabSearch(start: number, len: number): Promise<string>;

    public abstract getSearchLen(): Promise<number>;

    public abstract applySearchFilters(
        filters: Array<{
            value: string;
            is_regex: boolean;
            ignore_case: boolean;
            is_word: boolean;
        }>,
        operationUuid: string,
    ): Promise<void>;

    public abstract extractMatches(
        filters: Array<{
            value: string;
            is_regex: boolean;
            ignore_case: boolean;
            is_word: boolean;
        }>,
        operationUuid: string,
    ): Promise<void>;

    public abstract getMap(
        operationUuid: string,
        datasetLength: number,
        from?: number,
        to?: number,
    ): Promise<string>;

    public abstract getNearestTo(
        operationUuid: string,
        positionInStream: number,
    ): Promise<number[] | null>;

    public abstract abort(
        selfOperationUuid: string,
        targetOperationUuid: string,
    ): boolean | NativeError;

    public abstract setDebug(debug: boolean): Promise<void>;

    public abstract getOperationsStat(): Promise<string>;

    public abstract sleep(operationUuid: string, duration: number): Promise<void>;

    // public abstract sleepUnblock(duration: number): Promise<void>;
}

export function rustSessionFactory(
    uuid: string,
    provider: Computation<any, any, any>,
): Promise<RustSession> {
    return new Promise((resolve, reject) => {
        const session = new RustSessionConstructor(uuid, provider, (err: Error | undefined) => {
            if (err instanceof Error) {
                reject(err);
            } else {
                resolve(session);
            }
        });
    });
}

export class RustSessionWrapper extends RustSession {
    private readonly _logger: Logs.Logger = Logs.getLogger(`RustSessionWrapper`);
    private readonly _uuid: string;
    private readonly _native: RustSessionNative;
    private _assigned: boolean = false;
    private _provider: Computation<any, any, any>;

    constructor(
        uuid: string,
        provider: Computation<any, any, any>,
        cb: (err: Error | undefined) => void,
    ) {
        super(uuid, provider);
        this._native = new (getNativeModule().RustSession)(uuid) as RustSessionNative;
        this._logger.debug(`Rust native session is created`);
        this._uuid = uuid;
        this._provider = provider;
        this._provider.debug().emit.operation('init');
        this._native
            .init(provider.getEmitter())
            .then(() => {
                this._logger.debug(`Rust native session is inited`);
                cb(undefined);
            })
            .catch((err: Error) => {
                this._logger.error(`Fail to init session: ${err.message}`);
                cb(err);
            });
    }

    public destroy(): Promise<void> {
        const destroyOperationId = uuidv4();
        this._provider.debug().emit.operation('stop', destroyOperationId);
        return this._native.stop(destroyOperationId).then(() => {
            this._logger.debug(`Session has been destroyed`);
        });
    }

    public getUuid(): string {
        return this._native.getUuid();
    }

    public grabStreamChunk(start: number, len: number): Promise<IGrabbedElement[]> {
        return new Promise((resolve, reject) => {
            this._provider.debug().emit.operation('grab');
            this._native
                .grab(start, len)
                .then((grabbed: string) => {
                    try {
                        const result: IGrabbedContent = JSON.parse(grabbed);
                        resolve(
                            result.grabbed_elements.map((item: IGrabbedElement) => {
                                return {
                                    content:
                                        item.content === undefined ? (item as any).c : item.content,
                                    source_id:
                                        item.source_id === undefined
                                            ? (item as any).id
                                            : item.source_id,
                                };
                            }),
                        );
                    } catch (err) {
                        reject(
                            new NativeError(
                                new Error(
                                    this._logger.error(
                                        `Fail to call grab(${start}, ${len}) due error: ${
                                            err instanceof Error ? err.message : err
                                        }`,
                                    ),
                                ),
                                Type.ParsingContentChunk,
                                Source.GrabStreamChunk,
                            ),
                        );
                    }
                })
                .catch((err) => {
                    reject(
                        new NativeError(
                            NativeError.from(err),
                            Type.GrabbingContent,
                            Source.GrabStreamChunk,
                        ),
                    );
                });
        });
    }

    public grabSearchChunk(start: number, len: number): Promise<IGrabbedElement[]> {
        return new Promise((resolve, reject) => {
            this._provider.debug().emit.operation('grabSearch');
            this._native
                .grabSearch(start, len)
                .then((grabbed: string) => {
                    try {
                        const result: IGrabbedContent = JSON.parse(grabbed);
                        resolve(
                            result.grabbed_elements.map((item: IGrabbedElement) => {
                                return {
                                    content:
                                        item.content === undefined ? (item as any).c : item.content,
                                    source_id:
                                        item.source_id === undefined
                                            ? (item as any).id
                                            : item.source_id,
                                    position:
                                        item.position === undefined
                                            ? (item as any).p
                                            : item.position,
                                    row: item.row === undefined ? (item as any).r : item.row,
                                };
                            }),
                        );
                    } catch (err) {
                        reject(
                            new NativeError(
                                new Error(
                                    this._logger.error(
                                        `Fail to call grab(${start}, ${len}) due error: ${
                                            err instanceof Error ? err.message : err
                                        }`,
                                    ),
                                ),
                                Type.ParsingSearchChunk,
                                Source.GrabSearchChunk,
                            ),
                        );
                    }
                })
                .catch((err) => {
                    reject(
                        new NativeError(
                            NativeError.from(err),
                            Type.GrabbingSearch,
                            Source.GrabSearchChunk,
                        ),
                    );
                });
        });
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

    public getStreamLen(): Promise<number> {
        return new Promise((resolve, reject) => {
            this._provider.debug().emit.operation('getStreamLen');
            this._native
                .getStreamLen()
                .then(resolve)
                .catch((err) => {
                    reject(new NativeError(NativeError.from(err), Type.Other, Source.GetStreamLen));
                });
        });
    }

    public getSearchLen(): Promise<number> {
        return new Promise((resolve, reject) => {
            this._provider.debug().emit.operation('getSearchLen');
            this._native
                .getSearchLen()
                .then(resolve)
                .catch((err) => {
                    reject(new NativeError(NativeError.from(err), Type.Other, Source.GetSearchLen));
                });
        });
    }

    public getMatchesLen(): number | NativeError {
        return this._assigned ? 1000 : 0;
    }

    public getSocketPath(): string | NativeError {
        // return new NativeError(new Error('Not implemented yet'), Type.Other, Source.GetSocketPath);
        return '';
    }

    public assign(filename: string, options: TFileOptions, operationUuid: string): Promise<void> {
        return new Promise((resolve, reject) => {
            try {
                this._provider.debug().emit.operation('assign', operationUuid);
                this._native
                    .assign(filename, filename, operationUuid)
                    .then(resolve)
                    .catch((err: Error) => {
                        reject(new NativeError(NativeError.from(err), Type.Other, Source.Assign));
                    });
            } catch (err) {
                return reject(new NativeError(NativeError.from(err), Type.Other, Source.Assign));
            }
        });
    }

    public concat(files: IConcatFile[], append: boolean, operationUuid: string): Promise<void> {
        return new Promise((resolve, reject) => {
            try {
                this._provider.debug().emit.operation('concat', operationUuid);
                this._native
                    .concat(files, append, operationUuid)
                    .then(resolve)
                    .catch((err: Error) => {
                        reject(new NativeError(NativeError.from(err), Type.Other, Source.Assign));
                    });
            } catch (err) {
                return reject(new NativeError(NativeError.from(err), Type.Other, Source.Assign));
            }
        });
    }

    public merge(
        files: IFileMergeOptions[],
        append: boolean,
        operationUuid: string,
    ): Promise<void> {
        return new Promise((resolve, reject) => {
            try {
                this._provider.debug().emit.operation('merge', operationUuid);
                this._native
                    .merge(files, append, operationUuid)
                    .then(resolve)
                    .catch((err: Error) => {
                        reject(new NativeError(NativeError.from(err), Type.Other, Source.Merge));
                    });
            } catch (err) {
                return reject(new NativeError(NativeError.from(err), Type.Other, Source.Merge));
            }
        });
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

    public search(filters: IFilter[], operationUuid: string): Promise<void> {
        return new Promise((resolve, reject) => {
            try {
                this._provider.debug().emit.operation('applySearchFilters', operationUuid);
                this._native
                    .applySearchFilters(
                        filters.map((filter) => {
                            return {
                                value: filter.filter,
                                is_regex: filter.flags.reg,
                                ignore_case: !filter.flags.cases,
                                is_word: filter.flags.word,
                            };
                        }),
                        operationUuid,
                    )
                    .then(resolve)
                    .catch((err: Error) => {
                        reject(new NativeError(NativeError.from(err), Type.Other, Source.Search));
                    });
            } catch (err) {
                return reject(new NativeError(NativeError.from(err), Type.Other, Source.Search));
            }
        });
    }

    public extractMatchesValues(filters: IFilter[], operationUuid: string): Promise<void> {
        return new Promise((resolve, reject) => {
            try {
                this._provider.debug().emit.operation('extractMatches', operationUuid);
                this._native
                    .extractMatches(
                        filters.map((filter) => {
                            return {
                                value: filter.filter,
                                is_regex: filter.flags.reg,
                                ignore_case: !filter.flags.cases,
                                is_word: filter.flags.word,
                            };
                        }),
                        operationUuid,
                    )
                    .then(resolve)
                    .catch((err: Error) => {
                        reject(
                            new NativeError(
                                NativeError.from(err),
                                Type.Other,
                                Source.ExtractMatchesValues,
                            ),
                        );
                    });
            } catch (err) {
                return reject(
                    new NativeError(NativeError.from(err), Type.Other, Source.ExtractMatchesValues),
                );
            }
        });
    }

    public getMap(
        operationUuid: string,
        datasetLength: number,
        from?: number,
        to?: number,
    ): Promise<string> {
        return new Promise((resolve, reject) => {
            this._provider.debug().emit.operation('getMap', operationUuid);
            (() => {
                if (from === undefined || to === undefined) {
                    return this._native.getMap(operationUuid, datasetLength);
                } else {
                    return this._native.getMap(operationUuid, datasetLength, from, to);
                }
            })()
                .then(resolve)
                .catch((err) => {
                    reject(new NativeError(NativeError.from(err), Type.Other, Source.GetMap));
                });
        });
    }

    public getNearestTo(
        operationUuid: string,
        positionInStream: number,
    ): Promise<{ index: number; position: number } | undefined> {
        return new Promise((resolve, reject) => {
            this._provider.debug().emit.operation('getNearestTo', operationUuid);
            this._native
                .getNearestTo(operationUuid, positionInStream)
                .then((nearest) => {
                    if (nearest instanceof Array && nearest.length !== 2) {
                        reject(
                            new NativeError(
                                new Error(
                                    `Invalid format of data: ${nearest}. Expecting an array (size 2): [number, number]`,
                                ),
                                Type.InvalidOutput,
                                Source.GetNearestTo,
                            ),
                        );
                    } else if (nearest === null) {
                        resolve(undefined);
                    } else if (nearest instanceof Array && nearest.length === 2) {
                        resolve({ index: nearest[0], position: nearest[1] });
                    }
                })
                .catch((err) => {
                    reject(new NativeError(NativeError.from(err), Type.Other, Source.GetNearestTo));
                });
        });
    }

    public abort(selfOperationUuid: string, targetOperationUuid: string): boolean | NativeError {
        try {
            this._provider.debug().emit.operation('abort', selfOperationUuid);
            return this._native.abort(selfOperationUuid, targetOperationUuid);
        } catch (err) {
            return new NativeError(NativeError.from(err), Type.CancelationError, Source.Abort);
        }
    }

    public setDebug(debug: boolean): Promise<void> {
        return new Promise((resolve, reject) => {
            this._native
                .setDebug(debug)
                .then(resolve)
                .catch((err) => {
                    reject(new NativeError(NativeError.from(err), Type.Other, Source.Sleep));
                });
        });
    }

    public getOperationsStat(): Promise<string> {
        return new Promise((resolve, reject) => {
            this._native
                .getOperationsStat()
                .then(resolve)
                .catch((err) => {
                    reject(new NativeError(NativeError.from(err), Type.Other, Source.Sleep));
                });
        });
    }

    public sleep(operationUuid: string, duration: number): Promise<void> {
        return new Promise((resolve, reject) => {
            this._provider.debug().emit.operation('sleep', operationUuid);
            this._native
                .sleep(operationUuid, duration)
                .then(resolve)
                .catch((err) => {
                    reject(new NativeError(NativeError.from(err), Type.Other, Source.Sleep));
                });
        });
    }

    // public sleep(duration: number): undefined | NativeError {
    //     try {
    //         this._native.sleep(duration);
    //         return undefined;
    //     } catch (err) {
    //         return new NativeError(NativeError.from(err), Type.CancelationError, Source.Abort);
    //     }
    // }

    // public sleepUnblock(duration: number): Promise<void> {
    //     try {
    //         return this._native.sleepUnblock(duration);
    //     } catch (err) {
    //         return Promise.reject(new NativeError(NativeError.from(err), Type.CancelationError, Source.Abort));
    //     }
    // }
}

let RustSessionWrapperConstructor: RustSessionConstructorImpl<RustSessionWrapper> =
    RustSessionWrapper;

let RustSessionConstructor: RustSessionConstructorImpl<RustSession>;

RustSessionConstructor = RustSessionWrapperConstructor;

export { RustSessionConstructor };
