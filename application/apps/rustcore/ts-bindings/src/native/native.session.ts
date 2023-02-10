/* eslint-disable @typescript-eslint/no-unused-vars */
import * as Logs from '../util/logging';

import { RustSessionRequiered } from '../native/native.session.required';
import { TEventEmitter } from '../provider/provider.general';
import { Computation } from '../provider/provider';
import {
    IFilter,
    IGrabbedElement,
    IExtractDTFormatResult,
    IExtractDTFormatOptions,
    Observe,
} from '../interfaces/index';
import { getNativeModule } from '../native/native';
import { EFileOptionsRequirements } from '../api/executors/session.stream.observe.executor';
import { Type, Source, NativeError } from '../interfaces/errors';
import { v4 as uuidv4 } from 'uuid';
import { getValidNum } from '../util/numbers';
import { IRange } from 'platform/types/range';
import { ObservedSourceLink } from 'platform/types/observe';
import { IndexingMode } from 'platform/types/content';

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
    public abstract grabStreamChunk(start: number, len: number): Promise<IGrabbedElement[]>;

    public abstract grabStreamRanges(ranges: IRange[]): Promise<IGrabbedElement[]>;

    public abstract grabIndexed(start: number, len: number): Promise<IGrabbedElement[]>;

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
    public abstract grabSearchChunk(start: number, len: number): Promise<IGrabbedElement[]>;

    /**
     * TODO: @return needs interface. It should not be a string
     */
    public abstract grabMatchesChunk(start: number, len: number): string[] | NativeError;

    /**
     * Returns list of observed sources.
     * @returns { string }
     */
    public abstract getSourcesDefinitions(): Promise<ObservedSourceLink[]>;

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
    public abstract observe(source: Observe.DataSource, operationUuid: string): Promise<void>;

    public abstract export(dest: string, ranges: IRange[], operationUuid: string): Promise<void>;

    public abstract exportRaw(dest: string, ranges: IRange[], operationUuid: string): Promise<void>;

    public abstract isRawExportAvailable(): Promise<boolean>;

    /**
     * This operation is sync.
     */
    public abstract extract(options: IExtractDTFormatOptions): IExtractDTFormatResult | NativeError;

    public abstract search(filters: IFilter[], operationUuid: string): Promise<void>;

    public abstract searchValues(filters: string[], operationUuid: string): Promise<void>;

    public abstract dropSearch(): Promise<boolean>;

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

    public abstract sendIntoSde(targetOperationUuid: string, jsonStrMsg: string): Promise<string>;

    public abstract abort(
        selfOperationUuid: string,
        targetOperationUuid: string,
    ): NativeError | undefined;

    public abstract setDebug(debug: boolean): Promise<void>;

    public abstract getOperationsStat(): Promise<string>;

    public abstract sleep(operationUuid: string, duration: number): Promise<void>;

    // public abstract sleepUnblock(duration: number): Promise<void>;
}

export abstract class RustSessionNative {
    public abstract stop(operationUuid: string): Promise<void>;

    public abstract init(callback: TEventEmitter): Promise<void>;

    public abstract getUuid(): string;

    public abstract observe(source: string, operationUuid: string): Promise<void>;

    public abstract getStreamLen(): Promise<number>;

    public abstract getSourcesDefinitions(): Promise<ObservedSourceLink[]>;

    public abstract grab(start: number, len: number): Promise<string>;

    public abstract grabIndexed(start: number, len: number): Promise<string>;

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

    public abstract grabRanges(ranges: number[][]): Promise<string>;

    public abstract grabSearch(start: number, len: number): Promise<string>;

    public abstract getSearchLen(): Promise<number>;

    public abstract export(dest: string, ranges: number[][], operationUuid: string): Promise<void>;

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
    ): Promise<string>;

    public abstract getNearestTo(
        operationUuid: string,
        positionInStream: number,
    ): Promise<number[] | null>;

    public abstract sendIntoSde(targetOperationUuid: string, jsonStrMsg: string): Promise<string>;

    public abstract abort(
        selfOperationUuid: string,
        targetOperationUuid: string,
    ): NativeError | undefined;

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
                this._logger.error(`Timeout error. Session wasn't closed in 5 sec.`);
                reject(new Error(`Timeout error. Session wasn't closed in 5 sec.`));
            }, 5000);
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

    public getUuid(): string {
        return this._native.getUuid();
    }

    public getSourcesDefinitions(): Promise<ObservedSourceLink[]> {
        return new Promise((resolve, reject) => {
            this._provider.debug().emit.operation('getSourcesDefinitions');
            this._native
                .getSourcesDefinitions()
                .then((sources: ObservedSourceLink[]) => {
                    resolve(sources);
                })
                .catch((err) => {
                    reject(
                        new NativeError(
                            NativeError.from(err),
                            Type.GrabbingContent,
                            Source.GetSourcesDefinitions,
                        ),
                    );
                });
        });
    }

    public grabStreamChunk(start: number, len: number): Promise<IGrabbedElement[]> {
        return new Promise((resolve, reject) => {
            this._provider.debug().emit.operation('grab');
            this._native
                .grab(start, len)
                .then((grabbed: string) => {
                    try {
                        const result: Array<{
                            c: string;
                            id: number;
                            p: number;
                            n: number;
                        }> = JSON.parse(grabbed);
                        resolve(
                            result.map(
                                (
                                    item: {
                                        c: string;
                                        id: number;
                                        p: number;
                                        n: number;
                                    },
                                    i: number,
                                ) => {
                                    return {
                                        content: item.c,
                                        source_id: item.id,
                                        position: getValidNum(item.p),
                                        nature: item.n,
                                    };
                                },
                            ),
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

    public grabIndexed(start: number, len: number): Promise<IGrabbedElement[]> {
        return new Promise((resolve, reject) => {
            this._provider.debug().emit.operation('grabIndexed');
            this._native
                .grabIndexed(start, len)
                .then((grabbed: string) => {
                    try {
                        const result: Array<{
                            c: string;
                            id: number;
                            p: unknown;
                            n: number;
                        }> = JSON.parse(grabbed);
                        resolve(
                            result.map(
                                (
                                    item: {
                                        c: string;
                                        id: number;
                                        p: unknown;
                                        n: number;
                                    },
                                    i: number,
                                ) => {
                                    return {
                                        content: item.c,
                                        source_id: item.id,
                                        position: getValidNum(item.p),
                                        nature: item.n,
                                    };
                                },
                            ),
                        );
                    } catch (err) {
                        reject(
                            new NativeError(
                                new Error(
                                    this._logger.error(
                                        `Fail to call grabIndexed(${start}, ${len}) due error: ${
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

    public setIndexingMode(mode: IndexingMode): Promise<void> {
        return new Promise((resolve, reject) => {
            this._provider.debug().emit.operation('setIndexingMode');
            this._native
                .setIndexingMode(mode)
                .then(resolve)
                .catch((err) => {
                    reject(
                        new NativeError(
                            NativeError.from(err),
                            Type.ContentManipulation,
                            Source.SetIndexingMode,
                        ),
                    );
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
                    reject(
                        new NativeError(
                            NativeError.from(err),
                            Type.ContentManipulation,
                            Source.GetIndexedLen,
                        ),
                    );
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
                    reject(
                        new NativeError(
                            NativeError.from(err),
                            Type.ContentManipulation,
                            Source.getAroundIndexes,
                        ),
                    );
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
                    reject(
                        new NativeError(
                            NativeError.from(err),
                            Type.ContentManipulation,
                            Source.ExpandBreadcrumbs,
                        ),
                    );
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
                    reject(
                        new NativeError(
                            NativeError.from(err),
                            Type.ContentManipulation,
                            Source.RemoveBookmark,
                        ),
                    );
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
                    reject(
                        new NativeError(
                            NativeError.from(err),
                            Type.ContentManipulation,
                            Source.AddBookmark,
                        ),
                    );
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
                    reject(
                        new NativeError(
                            NativeError.from(err),
                            Type.ContentManipulation,
                            Source.SetBookmarks,
                        ),
                    );
                });
        });
    }

    public grabStreamRanges(ranges: IRange[]): Promise<IGrabbedElement[]> {
        return new Promise((resolve, reject) => {
            try {
                this._provider.debug().emit.operation('grabRanges');
                this._native
                    .grabRanges(ranges.map((r) => [r.from, r.to]))
                    .then((grabbed: string) => {
                        try {
                            const result: Array<{
                                c: string;
                                id: number;
                                p: number;
                                n: number;
                            }> = JSON.parse(grabbed);
                            resolve(
                                result.map(
                                    (
                                        item: {
                                            c: string;
                                            id: number;
                                            p: number;
                                            n: number;
                                        },
                                        i: number,
                                    ) => {
                                        return {
                                            content: item.c,
                                            source_id: item.id,
                                            position: getValidNum(item.p),
                                            nature: item.n,
                                        };
                                    },
                                ),
                            );
                        } catch (err) {
                            reject(
                                new NativeError(
                                    new Error(
                                        this._logger.error(
                                            `Fail to call grab ranges due error: ${
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
                    .catch((err: Error) => {
                        reject(
                            new NativeError(
                                NativeError.from(err),
                                Type.Other,
                                Source.GrabStreamChunk,
                            ),
                        );
                    });
            } catch (err) {
                return reject(
                    new NativeError(NativeError.from(err), Type.Other, Source.GrabStreamChunk),
                );
            }
        });
    }

    public grabSearchChunk(start: number, len: number): Promise<IGrabbedElement[]> {
        return new Promise((resolve, reject) => {
            this._provider.debug().emit.operation('grabSearch');
            this._native
                .grabSearch(start, len)
                .then((grabbed: string) => {
                    try {
                        const result: Array<{
                            c: string;
                            id: number;
                            p: number;
                            n: number;
                        }> = JSON.parse(grabbed);
                        resolve(
                            result.map(
                                (
                                    item: {
                                        c: string;
                                        id: number;
                                        p: unknown;
                                        n: number;
                                    },
                                    i: number,
                                ) => {
                                    return {
                                        content: item.c,
                                        source_id: item.id,
                                        position: getValidNum(item.p),
                                        nature: item.n,
                                    };
                                },
                            ),
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

    public observe(source: Observe.DataSource, operationUuid: string): Promise<void> {
        return new Promise((resolve, reject) => {
            try {
                this._provider.debug().emit.operation('observe', operationUuid);
                this._native
                    .observe(source.toJSON(), operationUuid)
                    .then(resolve)
                    .catch((err: Error) => {
                        reject(new NativeError(NativeError.from(err), Type.Other, Source.Assign));
                    });
            } catch (err) {
                return reject(new NativeError(NativeError.from(err), Type.Other, Source.Assign));
            }
        });
    }

    public export(dest: string, ranges: IRange[], operationUuid: string): Promise<void> {
        return new Promise((resolve, reject) => {
            try {
                this._provider.debug().emit.operation('export', operationUuid);
                this._native
                    .export(
                        dest,
                        ranges.map((r) => [r.from, r.to]),
                        operationUuid,
                    )
                    .then(resolve)
                    .catch((err: Error) => {
                        reject(new NativeError(NativeError.from(err), Type.Other, Source.Assign));
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
                        ranges.map((r) => [r.from, r.to]),
                        operationUuid,
                    )
                    .then(resolve)
                    .catch((err: Error) => {
                        reject(new NativeError(NativeError.from(err), Type.Other, Source.Assign));
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
                    reject(new NativeError(NativeError.from(err), Type.Other, Source.GetSearchLen));
                });
        });
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

    public searchValues(filters: string[], operationUuid: string): Promise<void> {
        return new Promise((resolve, reject) => {
            try {
                this._provider.debug().emit.operation('applySearchValuesFilters', operationUuid);
                this._native
                    .applySearchValuesFilters(filters, operationUuid)
                    .then(resolve)
                    .catch((err: Error) => {
                        reject(
                            new NativeError(NativeError.from(err), Type.Other, Source.SearchValues),
                        );
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

    public sendIntoSde(targetOperationUuid: string, jsonStrMsg: string): Promise<string> {
        return new Promise((resolve, reject) => {
            this._native
                .sendIntoSde(targetOperationUuid, jsonStrMsg)
                .then(resolve)
                .catch((err) => {
                    reject(new NativeError(NativeError.from(err), Type.Other, Source.SendIntoSde));
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
                    reject(new NativeError(NativeError.from(err), Type.Other, Source.SetDebug));
                });
        });
    }

    public getOperationsStat(): Promise<string> {
        return new Promise((resolve, reject) => {
            this._native
                .getOperationsStat()
                .then(resolve)
                .catch((err) => {
                    reject(
                        new NativeError(
                            NativeError.from(err),
                            Type.Other,
                            Source.GetOperationsStat,
                        ),
                    );
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

export const RustSessionWrapperConstructor: RustSessionConstructorImpl<RustSessionWrapper> =
    RustSessionWrapper;

export const RustSessionConstructor: RustSessionConstructorImpl<RustSession> =
    RustSessionWrapperConstructor;
