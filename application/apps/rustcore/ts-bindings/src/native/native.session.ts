/* eslint-disable @typescript-eslint/no-unused-vars */
import { RustSessionRequiered } from '../native/native.session.required';
import { TEventEmitter } from '../provider/provider.general';
import { Computation } from '../provider/provider';
import { IFilter } from 'platform/types/filter';
import { GrabbedElement } from 'platform/types/bindings/miscellaneous';
import { getNativeModule } from '../native/native';
import { EFileOptionsRequirements } from '../api/executors/session.stream.observe.executor';
import { Type, Source, NativeError } from '../interfaces/errors';
import { v4 as uuidv4 } from 'uuid';
import { getValidNum } from '../util/numbers';
import { IRange, fromTuple } from 'platform/types/range';
import { ISourceLink } from 'platform/types/observe/types';
import { IndexingMode, Attachment } from 'platform/types/content';
import { Logger, utils } from 'platform/log';
import { scope } from 'platform/env/scope';
import { IObserve } from 'platform/types/observe';
import { TextExportOptions } from 'platform/types/exporting';

import * as protocol from 'protocol';
import * as types from 'platform/types';

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

    public abstract override destroy(): Promise<void>;

    /**
     * Returns chunk of stream/session file.
     * @param start { number } row number of range's start
     * @param len { number } length of the chunk's range
     * @returns { string }
     *
     * @error In case of incorrect range should return { NativeError }
     */
    public abstract grabStreamChunk(start: number, len: number): Promise<GrabbedElement[]>;

    public abstract grabStreamRanges(ranges: IRange[]): Promise<GrabbedElement[]>;

    public abstract grabIndexed(start: number, len: number): Promise<GrabbedElement[]>;

    public abstract setIndexingMode(mode: IndexingMode): Promise<void>;

    public abstract getIndexedLen(): Promise<number>;

    public abstract getAroundIndexes(
        position: number,
    ): Promise<{ before: number | undefined; after: number | undefined }>;

    public abstract expandBreadcrumbs(
        seporator: number,
        offset: number,
        above: boolean,
    ): Promise<void>;

    public abstract removeBookmark(row: number): Promise<void>;

    public abstract addBookmark(row: number): Promise<void>;

    public abstract setBookmarks(rows: number[]): Promise<void>;

    /**
     * Returns chunk of stream/session file.
     * @param start { number } row number of range's start
     * @param len { number } length of the chunk's range
     * @returns { string }
     * @error In case of incorrect range should return { NativeError }
     */
    public abstract grabSearchChunk(start: number, len: number): Promise<GrabbedElement[]>;

    /**
     * TODO: @return needs interface. It should not be a string
     */
    public abstract grabMatchesChunk(start: number, len: number): string[] | NativeError;

    /**
     * Returns list of observed sources.
     * @returns { string }
     */
    public abstract getSourcesDefinitions(): Promise<ISourceLink[]>;

    public abstract getUuid(): string;

    public abstract getSessionFile(): Promise<string>;

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
    public abstract observe(source: IObserve, operationUuid: string): Promise<void>;

    public abstract export(
        dest: string,
        ranges: IRange[],
        opt: TextExportOptions,
        operationUuid: string,
    ): Promise<void>;

    public abstract exportRaw(dest: string, ranges: IRange[], operationUuid: string): Promise<void>;

    public abstract isRawExportAvailable(): Promise<boolean>;

    public abstract searchNestedMatch(
        filter: IFilter,
        from: number,
    ): Promise<[number, number] | undefined>;

    public abstract search(filters: IFilter[], operationUuid: string): Promise<void>;

    public abstract searchValues(filters: string[], operationUuid: string): Promise<void>;

    public abstract dropSearch(): Promise<boolean>;

    public abstract extractMatchesValues(filters: IFilter[], operationUuid: string): Promise<void>;

    public abstract getMap(
        operationUuid: string,
        datasetLength: number,
        from?: number,
        to?: number,
    ): Promise<void>;

    public abstract getValues(
        operationUuid: string,
        datasetLength: number,
        from?: number,
        to?: number,
    ): Promise<void>;

    public abstract getNearestTo(
        operationUuid: string,
        positionInStream: number,
    ): Promise<{ index: number; position: number } | undefined>;

    public abstract sendIntoSde(
        targetOperationUuid: string,
        request: types.sde.SdeRequest,
    ): Promise<types.sde.SdeResponse>;

    public abstract getAttachments(): Promise<Attachment[]>;
    public abstract getIndexedRanges(): Promise<IRange[]>;

    public abstract abort(
        selfOperationUuid: string,
        targetOperationUuid: string,
    ): NativeError | undefined;

    public abstract setDebug(debug: boolean): Promise<void>;

    public abstract getOperationsStat(): Promise<string>;

    // Used only for testing and debug
    public abstract sleep(
        operationUuid: string,
        duration: number,
        ignoreCancellation: boolean,
    ): Promise<void>;

    // Used only for testing and debug
    public abstract triggerStateError(): Promise<void>;

    // Used only for testing and debug
    public abstract triggerTrackerError(): Promise<void>;

    // Used only for testing and debug
    public abstract testGrabElsAsJson(): GrabbedElement[] | NativeError;

    // Used only for testing and debug
    public abstract testGrabElsAsBin(): GrabbedElement[] | NativeError;
}

export abstract class RustSessionNative {
    public abstract stop(operationUuid: string): Promise<void>;

    public abstract init(callback: TEventEmitter): Promise<void>;

    public abstract getUuid(): string;

    public abstract getSessionFile(): Promise<string>;

    public abstract observe(source: Uint8Array, operationUuid: string): Promise<void>;

    public abstract getStreamLen(): Promise<number>;

    public abstract getSourcesDefinitions(): Promise<Uint8Array>;

    public abstract grab(start: number, len: number): Promise<Uint8Array>;

    public abstract grabIndexed(start: number, len: number): Promise<Uint8Array>;

    public abstract setIndexingMode(mode: number): Promise<void>;

    public abstract getIndexedLen(): Promise<number>;

    public abstract getAroundIndexes(position: number): Promise<[number | null, number | null]>;

    public abstract expandBreadcrumbs(
        seporator: number,
        offset: number,
        above: boolean,
    ): Promise<void>;

    public abstract removeBookmark(row: number): Promise<void>;

    public abstract addBookmark(row: number): Promise<void>;

    public abstract setBookmarks(rows: number[]): Promise<void>;

    public abstract grabRanges(ranges: number[][]): Promise<Uint8Array>;

    public abstract grabSearch(start: number, len: number): Promise<Uint8Array>;

    public abstract getSearchLen(): Promise<number>;

    public abstract export(
        dest: string,
        ranges: number[][],
        columns: number[],
        spliter: string,
        delimiter: string,
        operationUuid: string,
    ): Promise<void>;

    public abstract exportRaw(
        dest: string,
        ranges: number[][],
        operationUuid: string,
    ): Promise<void>;

    public abstract isRawExportAvailable(): Promise<boolean>;

    public abstract applySearchFilters(
        filters: Array<{
            value: string;
            is_regex: boolean;
            ignore_case: boolean;
            is_word: boolean;
        }>,
        operationUuid: string,
    ): Promise<void>;

    public abstract searchNestedMatch(
        filter: {
            value: string;
            is_regex: boolean;
            ignore_case: boolean;
            is_word: boolean;
        },
        from: number,
    ): Promise<[number, number] | undefined>;

    public abstract applySearchValuesFilters(
        filters: string[],
        operationUuid: string,
    ): Promise<void>;

    public abstract dropSearch(): Promise<boolean>;

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
    ): Promise<void>;

    public abstract getValues(
        operationUuid: string,
        datasetLength: number,
        from?: number,
        to?: number,
    ): Promise<void>;

    public abstract getNearestTo(
        operationUuid: string,
        positionInStream: number,
    ): Promise<number[] | null>;

    public abstract sendIntoSde(
        targetOperationUuid: string,
        request: Uint8Array,
    ): Promise<Uint8Array>;
    public abstract getAttachments(): Promise<Uint8Array>;
    public abstract getIndexedRanges(): Promise<Uint8Array>;

    public abstract abort(
        selfOperationUuid: string,
        targetOperationUuid: string,
    ): NativeError | undefined;

    public abstract setDebug(debug: boolean): Promise<void>;

    public abstract getOperationsStat(): Promise<string>;

    // Used only for testing and debug
    public abstract sleep(
        operationUuid: string,
        duration: number,
        ignoreCancellation: boolean,
    ): Promise<void>;

    // Used only for testing and debug
    public abstract triggerStateError(): Promise<void>;

    // Used only for testing and debug
    public abstract triggerTrackerError(): Promise<void>;

    // Used only for testing and debug
    public abstract testGrabElsAsJson(): string;

    // Used only for testing and debug
    public abstract testGrabElsAsBin(): number[];
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

const DESTROY_TIMEOUT = 5000;

export class RustSessionWrapper extends RustSession {
    private readonly _logger: Logger = scope.getLogger(`RustSessionWrapper`);
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
                this._logger.error(
                    `Fail to init session: ${err instanceof Error ? err.message : err}`,
                );
                cb(err);
            });
    }

    public destroy(): Promise<void> {
        const destroyOperationId = uuidv4();
        this._provider.debug().emit.operation('stop', destroyOperationId);
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(
                    new Error(
                        this._logger.error(
                            `Timeout error. Session wasn't closed in ${
                                DESTROY_TIMEOUT / 1000
                            } sec.`,
                        ),
                    ),
                );
            }, DESTROY_TIMEOUT);
            this._native
                .stop(destroyOperationId)
                .then(() => {
                    this._logger.debug(`Session has been destroyed`);
                    resolve();
                })
                .catch((err: Error) => {
                    this._logger.error(
                        `Fail to close session due error: ${
                            err instanceof Error ? err.message : err
                        }`,
                    );
                    reject(err);
                })
                .finally(() => {
                    clearTimeout(timeout);
                });
        });
    }

    public getSessionFile(): Promise<string> {
        return this._native.getSessionFile();
    }

    public getUuid(): string {
        return this._native.getUuid();
    }

    public getSourcesDefinitions(): Promise<ISourceLink[]> {
        return new Promise((resolve, reject) => {
            this._provider.debug().emit.operation('getSourcesDefinitions');
            this._native
                .getSourcesDefinitions()
                .then((buf: Uint8Array) => {
                    try {
                        resolve(protocol.decodeSources(buf));
                    } catch (err) {
                        reject(
                            new NativeError(
                                new Error(
                                    this._logger.error(
                                        `Fail to decode message: ${utils.error(err)}`,
                                    ),
                                ),
                                Type.InvalidOutput,
                                Source.GetSourcesDefinitions,
                            ),
                        );
                    }
                })
                .catch((err) => {
                    reject(NativeError.from(err));
                });
        });
    }

    public grabStreamChunk(start: number, len: number): Promise<GrabbedElement[]> {
        return new Promise((resolve, reject) => {
            this._provider.debug().emit.operation('grab');
            this._native
                .grab(start, len)
                .then((buf: Uint8Array) => {
                    try {
                        resolve(protocol.decodeGrabbedElementList(buf));
                    } catch (err) {
                        reject(
                            new NativeError(
                                new Error(
                                    this._logger.error(
                                        `Fail to decode message: ${utils.error(err)}`,
                                    ),
                                ),
                                Type.InvalidOutput,
                                Source.GrabStreamChunk,
                            ),
                        );
                    }
                })
                .catch((err) => {
                    reject(NativeError.from(err));
                });
        });
    }

    public grabIndexed(start: number, len: number): Promise<GrabbedElement[]> {
        return new Promise((resolve, reject) => {
            this._provider.debug().emit.operation('grabIndexed');
            this._native
                .grabIndexed(start, len)
                .then((buf: Uint8Array) => {
                    try {
                        resolve(protocol.decodeGrabbedElementList(buf));
                    } catch (err) {
                        reject(
                            new NativeError(
                                new Error(
                                    this._logger.error(
                                        `Fail to decode message: ${utils.error(err)}`,
                                    ),
                                ),
                                Type.InvalidOutput,
                                Source.GrabStreamChunk,
                            ),
                        );
                    }
                })
                .catch((err) => {
                    reject(NativeError.from(err));
                });
        });
    }

    public setIndexingMode(mode: IndexingMode): Promise<void> {
        return new Promise((resolve, reject) => {
            this._provider.debug().emit.operation('setIndexingMode');
            this._native
                .setIndexingMode(mode)
                .then(resolve)
                .catch((err) => {
                    reject(NativeError.from(err));
                });
        });
    }

    public getIndexedLen(): Promise<number> {
        return new Promise((resolve, reject) => {
            this._provider.debug().emit.operation('getIndexedLen');
            this._native
                .getIndexedLen()
                .then(resolve)
                .catch((err) => {
                    reject(NativeError.from(err));
                });
        });
    }

    public getAroundIndexes(
        position: number,
    ): Promise<{ before: number | undefined; after: number | undefined }> {
        return new Promise((resolve, reject) => {
            this._provider.debug().emit.operation('getAroundIndexes');
            this._native
                .getAroundIndexes(position)
                .then((result) => {
                    resolve({
                        before: typeof result[0] !== 'number' ? undefined : result[0],
                        after: typeof result[1] !== 'number' ? undefined : result[1],
                    });
                })
                .catch((err) => {
                    reject(NativeError.from(err));
                });
        });
    }

    public expandBreadcrumbs(seporator: number, offset: number, above: boolean): Promise<void> {
        return new Promise((resolve, reject) => {
            this._provider.debug().emit.operation('expandBreadcrumbs');
            this._native
                .expandBreadcrumbs(seporator, offset, above)
                .then(resolve)
                .catch((err) => {
                    reject(NativeError.from(err));
                });
        });
    }

    public removeBookmark(row: number): Promise<void> {
        return new Promise((resolve, reject) => {
            this._provider.debug().emit.operation('removeBookmark');
            this._native
                .removeBookmark(row)
                .then(resolve)
                .catch((err) => {
                    reject(NativeError.from(err));
                });
        });
    }

    public addBookmark(row: number): Promise<void> {
        return new Promise((resolve, reject) => {
            this._provider.debug().emit.operation('addBookmark');
            this._native
                .addBookmark(row)
                .then(resolve)
                .catch((err) => {
                    reject(NativeError.from(err));
                });
        });
    }

    public setBookmarks(rows: number[]): Promise<void> {
        return new Promise((resolve, reject) => {
            this._provider.debug().emit.operation('setBookmarks');
            this._native
                .setBookmarks(rows)
                .then(resolve)
                .catch((err) => {
                    reject(NativeError.from(err));
                });
        });
    }

    public grabStreamRanges(ranges: IRange[]): Promise<GrabbedElement[]> {
        return new Promise((resolve, reject) => {
            try {
                this._provider.debug().emit.operation('grabRanges');
                this._native
                    .grabRanges(ranges.map((r) => [r.start, r.end]))
                    .then((buf: Uint8Array) => {
                        try {
                            resolve(protocol.decodeGrabbedElementList(buf));
                        } catch (err) {
                            reject(
                                new NativeError(
                                    new Error(
                                        this._logger.error(
                                            `Fail to decode message: ${utils.error(err)}`,
                                        ),
                                    ),
                                    Type.InvalidOutput,
                                    Source.GrabStreamChunk,
                                ),
                            );
                        }
                    })
                    .catch((err: Error) => {
                        reject(NativeError.from(err));
                    });
            } catch (err) {
                return reject(
                    new NativeError(NativeError.from(err), Type.Other, Source.GrabStreamChunk),
                );
            }
        });
    }

    public grabSearchChunk(start: number, len: number): Promise<GrabbedElement[]> {
        return new Promise((resolve, reject) => {
            this._provider.debug().emit.operation('grabSearch');
            this._native
                .grabSearch(start, len)
                .then((buf: Uint8Array) => {
                    try {
                        resolve(protocol.decodeGrabbedElementList(buf));
                    } catch (err) {
                        reject(
                            new NativeError(
                                new Error(
                                    this._logger.error(
                                        `Fail to decode message: ${utils.error(err)}`,
                                    ),
                                ),
                                Type.InvalidOutput,
                                Source.GrabSearchChunk,
                            ),
                        );
                    }
                })
                .catch((err) => {
                    reject(NativeError.from(err));
                });
        });
    }

    public grabMatchesChunk(start: number, len: number): string[] | NativeError {
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
                    reject(NativeError.from(err));
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
                    reject(NativeError.from(err));
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

    public observe(source: IObserve, operationUuid: string): Promise<void> {
        return new Promise((resolve, reject) => {
            try {
                this._provider.debug().emit.operation('observe', operationUuid);
                this._native
                    .observe(protocol.encodeObserveOptions(source), operationUuid)
                    .then(resolve)
                    .catch((err: Error) => {
                        reject(NativeError.from(err));
                    });
            } catch (err) {
                return reject(new NativeError(NativeError.from(err), Type.Other, Source.Assign));
            }
        });
    }

    public export(
        dest: string,
        ranges: IRange[],
        opt: TextExportOptions,
        operationUuid: string,
    ): Promise<void> {
        return new Promise((resolve, reject) => {
            try {
                this._provider.debug().emit.operation('export', operationUuid);
                this._native
                    .export(
                        dest,
                        ranges.map((r) => [r.start, r.end]),
                        opt.columns,
                        opt.spliter === undefined ? '' : opt.spliter,
                        opt.delimiter === undefined ? '' : opt.delimiter,
                        operationUuid,
                    )
                    .then(resolve)
                    .catch((err: Error) => {
                        reject(NativeError.from(err));
                    });
            } catch (err) {
                return reject(new NativeError(NativeError.from(err), Type.Other, Source.Assign));
            }
        });
    }

    public exportRaw(dest: string, ranges: IRange[], operationUuid: string): Promise<void> {
        return new Promise((resolve, reject) => {
            try {
                this._provider.debug().emit.operation('exportRaw', operationUuid);
                this._native
                    .exportRaw(
                        dest,
                        ranges.map((r) => [r.start, r.end]),
                        operationUuid,
                    )
                    .then(resolve)
                    .catch((err: Error) => {
                        reject(NativeError.from(err));
                    });
            } catch (err) {
                return reject(new NativeError(NativeError.from(err), Type.Other, Source.Assign));
            }
        });
    }

    public isRawExportAvailable(): Promise<boolean> {
        return new Promise((resolve, reject) => {
            this._provider.debug().emit.operation('isRawExportAvailable');
            this._native
                .isRawExportAvailable()
                .then(resolve)
                .catch((err) => {
                    reject(NativeError.from(err));
                });
        });
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
                        reject(NativeError.from(err));
                    });
            } catch (err) {
                return reject(new NativeError(NativeError.from(err), Type.Other, Source.Search));
            }
        });
    }

    public searchNestedMatch(filter: IFilter, from: number): Promise<[number, number] | undefined> {
        return new Promise((resolve, reject) => {
            try {
                this._native
                    .searchNestedMatch(
                        {
                            value: filter.filter,
                            is_regex: filter.flags.reg,
                            ignore_case: !filter.flags.cases,
                            is_word: filter.flags.word,
                        },
                        from,
                    )
                    .then(resolve)
                    .catch((err: Error) => {
                        reject(NativeError.from(err));
                    });
            } catch (err) {
                return reject(
                    new NativeError(NativeError.from(err), Type.Other, Source.SearchNested),
                );
            }
        });
    }

    public searchValues(filters: string[], operationUuid: string): Promise<void> {
        return new Promise((resolve, reject) => {
            try {
                this._provider.debug().emit.operation('applySearchValuesFilters', operationUuid);
                this._native
                    .applySearchValuesFilters(filters, operationUuid)
                    .then(resolve)
                    .catch((err: Error) => {
                        reject(NativeError.from(err));
                    });
            } catch (err) {
                return reject(
                    new NativeError(NativeError.from(err), Type.Other, Source.SearchValues),
                );
            }
        });
    }

    public dropSearch(): Promise<boolean> {
        return this._native.dropSearch();
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
                        reject(NativeError.from(err));
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
    ): Promise<void> {
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
                    reject(NativeError.from(err));
                });
        });
    }

    public getValues(
        operationUuid: string,
        datasetLength: number,
        from?: number,
        to?: number,
    ): Promise<void> {
        return new Promise((resolve, reject) => {
            this._provider.debug().emit.operation('getValues', operationUuid);
            (() => {
                if (from === undefined || to === undefined) {
                    return this._native.getValues(operationUuid, datasetLength);
                } else {
                    return this._native.getValues(operationUuid, datasetLength, from, to);
                }
            })()
                .then(resolve)
                .catch((err) => {
                    reject(NativeError.from(err));
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
                    reject(NativeError.from(err));
                });
        });
    }

    public sendIntoSde(
        targetOperationUuid: string,
        request: types.sde.SdeRequest,
    ): Promise<types.sde.SdeResponse> {
        return new Promise((resolve, reject) => {
            this._native
                .sendIntoSde(targetOperationUuid, protocol.encodeSdeRequest(request))
                .then((buf: Uint8Array) => {
                    try {
                        resolve(protocol.decodeSdeResponse(buf));
                    } catch (err) {
                        reject(
                            new NativeError(
                                new Error(
                                    this._logger.error(
                                        `Fail to decode message: ${utils.error(err)}`,
                                    ),
                                ),
                                Type.InvalidOutput,
                                Source.SendIntoSde,
                            ),
                        );
                    }
                })
                .catch((err) => {
                    reject(NativeError.from(err));
                });
        });
    }

    public getAttachments(): Promise<Attachment[]> {
        return new Promise((resolve, reject) => {
            this._native
                .getAttachments()
                .then((buf: Uint8Array) => {
                    try {
                        resolve(protocol.decodeAttachmentList(buf));
                    } catch (err) {
                        reject(
                            new NativeError(
                                new Error(
                                    this._logger.error(
                                        `Fail to decode message: ${utils.error(err)}`,
                                    ),
                                ),
                                Type.InvalidOutput,
                                Source.GetAttachments,
                            ),
                        );
                    }
                })
                .catch((err) => {
                    reject(NativeError.from(err));
                });
        });
    }

    public getIndexedRanges(): Promise<IRange[]> {
        return new Promise((resolve, reject) => {
            this._native
                .getIndexedRanges()
                .then((buf: Uint8Array) => {
                    try {
                        resolve(protocol.decodeRanges(buf));
                    } catch (err) {
                        reject(
                            new NativeError(
                                new Error(
                                    this._logger.error(
                                        `Fail to decode message: ${utils.error(err)}`,
                                    ),
                                ),
                                Type.InvalidOutput,
                                Source.GetIndexedRanges,
                            ),
                        );
                    }
                })
                .catch((err) => {
                    reject(NativeError.from(err));
                });
        });
    }

    public abort(selfOperationUuid: string, targetOperationUuid: string): NativeError | undefined {
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
                    reject(NativeError.from(err));
                });
        });
    }

    public getOperationsStat(): Promise<string> {
        return new Promise((resolve, reject) => {
            this._native
                .getOperationsStat()
                .then(resolve)
                .catch((err) => {
                    reject(NativeError.from(err));
                });
        });
    }

    // Used only for testing and debug
    public sleep(
        operationUuid: string,
        duration: number,
        ignoreCancellation: boolean,
    ): Promise<void> {
        return new Promise((resolve, reject) => {
            this._provider.debug().emit.operation('sleep', operationUuid);
            this._native
                .sleep(operationUuid, duration, ignoreCancellation)
                .then(resolve)
                .catch((err) => {
                    reject(NativeError.from(err));
                });
        });
    }

    // Used only for testing and debug
    public triggerStateError(): Promise<void> {
        return new Promise((resolve, reject) => {
            this._provider.debug().emit.operation('triggerStateError');
            this._native
                .triggerStateError()
                .then(resolve)
                .catch((err) => {
                    reject(NativeError.from(err));
                });
        });
    }

    // Used only for testing and debug
    public triggerTrackerError(): Promise<void> {
        return new Promise((resolve, reject) => {
            this._provider.debug().emit.operation('triggerTrackerError');
            this._native
                .triggerTrackerError()
                .then(resolve)
                .catch((err) => {
                    reject(NativeError.from(err));
                });
        });
    }

    public testGrabElsAsJson(): GrabbedElement[] | NativeError {
        try {
            const lines: Array<{
                content: string;
                source_id: number;
                pos: number;
                nature: number;
            }> = JSON.parse(this._native.testGrabElsAsJson());
            const elements = lines.map(
                (
                    item: {
                        content: string;
                        source_id: number;
                        pos: number;
                        nature: number;
                    },
                    i: number,
                ) => {
                    return {
                        content: item.content,
                        source_id: item.source_id,
                        pos: getValidNum(item.pos),
                        nature: item.nature,
                    };
                },
            );
            return elements;
        } catch (err) {
            return new NativeError(new Error(utils.error(err)), Type.Other, Source.Other);
        }
    }

    public testGrabElsAsBin(): GrabbedElement[] | NativeError {
        try {
            const received = this._native.testGrabElsAsBin();
            const elements = protocol.decodeGrabbedElementList(Uint8Array.from(received));
            return elements;
        } catch (err) {
            return new NativeError(new Error(utils.error(err)), Type.Other, Source.Other);
        }
    }
}

export const RustSessionWrapperConstructor: RustSessionConstructorImpl<RustSessionWrapper> =
    RustSessionWrapper;

export const RustSessionConstructor: RustSessionConstructorImpl<RustSession> =
    RustSessionWrapperConstructor;
