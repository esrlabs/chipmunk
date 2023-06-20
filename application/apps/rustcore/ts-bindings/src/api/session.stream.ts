import { Logger } from 'platform/log';
import { scope } from 'platform/env/scope';
import { RustSession } from '../native/native.session';
import { ICancelablePromise } from 'platform/env/promise';
import { SdeRequest, SdeResponse } from 'platform/types/sde';
import { EventProvider } from '../api/session.provider';
import { Executors } from './executors/session.stream.executors';
import { EFileOptionsRequirements } from './executors/session.stream.observe.executor';
import {
    IGrabbedElement,
    IExtractDTFormatOptions,
    IExtractDTFormatResult,
} from '../interfaces/index';
import { IRange } from 'platform/types/range';
import { ISourceLink } from 'platform/types/observe/types';
import { Attachment, IndexingMode } from 'platform/types/content';
import { IObserve } from 'platform/types/observe';

export { IExtractDTFormatOptions, IExtractDTFormatResult };

export class SessionStream {
    private readonly _provider: EventProvider;
    private readonly _session: RustSession;
    private readonly _uuid: string;
    private readonly _logger: Logger;

    constructor(provider: EventProvider, session: RustSession, uuid: string) {
        this._logger = scope.getLogger(`SessionStream: ${uuid}`);
        this._provider = provider;
        this._session = session;
        this._uuid = uuid;
    }

    public destroy(): Promise<void> {
        return Promise.resolve(undefined);
    }

    public grab(start: number, len: number): Promise<IGrabbedElement[]> {
        return this._session.grabStreamChunk(start, len);
    }

    public grabIndexed(start: number, len: number): Promise<IGrabbedElement[]> {
        return this._session.grabIndexed(start, len);
    }

    public setIndexingMode(mode: IndexingMode): Promise<void> {
        return this._session.setIndexingMode(mode);
    }

    public getIndexedLen(): Promise<number> {
        return this._session.getIndexedLen();
    }

    public getAroundIndexes(position: number): Promise<{
        before: number | undefined;
        after: number | undefined;
    }> {
        return this._session.getAroundIndexes(position);
    }

    public addBookmark(row: number): Promise<void> {
        return this._session.addBookmark(row);
    }

    public setBookmarks(rows: number[]): Promise<void> {
        return this._session.setBookmarks(rows);
    }

    public removeBookmark(row: number): Promise<void> {
        return this._session.removeBookmark(row);
    }

    public expandBreadcrumbs(seporator: number, offset: number, above: boolean): Promise<void> {
        return this._session.expandBreadcrumbs(seporator, offset, above);
    }

    public grabRanges(ranges: IRange[]): Promise<IGrabbedElement[]> {
        return this._session.grabStreamRanges(ranges);
    }

    public getFileOptionsRequirements(filename: string): EFileOptionsRequirements {
        return this._session.getFileOptionsRequirements(filename);
    }

    public getSourcesDefinitions(): Promise<ISourceLink[]> {
        return this._session.getSourcesDefinitions();
    }

    public observe(source: IObserve): ICancelablePromise<void> {
        return Executors.observe(this._session, this._provider, this._logger, source);
    }

    public sde(operation: string, request: SdeRequest): Promise<SdeResponse> {
        return this._session.sendIntoSde(operation, JSON.stringify(request)).then((result) => {
            try {
                return JSON.parse(result) as SdeResponse;
            } catch (e) {
                return Promise.reject(new Error(`Fail to parse response`));
            }
        });
    }

    public getAttachments(): Promise<Attachment[]> {
        return this._session.getAttachments();
    }

    public export(dest: string, ranges: IRange[]): ICancelablePromise<boolean> {
        return Executors.export(this._session, this._provider, this._logger, { dest, ranges });
    }

    public exportRaw(dest: string, ranges: IRange[]): ICancelablePromise<boolean> {
        return Executors.exportRaw(this._session, this._provider, this._logger, { dest, ranges });
    }

    public extractTimeformat(options: IExtractDTFormatOptions): IExtractDTFormatResult | Error {
        let results: IExtractDTFormatResult | Error = this._session.extract(options);
        if (typeof results !== 'object' || results === null) {
            results = new Error(
                `Expecting {IExtractDTFormatOptions} as result of "extractTimeformat", but has been gotten: ${typeof results}`,
            );
        } else if (
            typeof results === 'object' &&
            (typeof (results as IExtractDTFormatResult).format !== 'string' ||
                typeof (results as IExtractDTFormatResult).reg !== 'string' ||
                typeof (results as IExtractDTFormatResult).timestamp !== 'number')
        ) {
            results = new Error(
                `Expecting {IExtractDTFormatOptions} as result of "extractTimeformat", but has been gotten: ${JSON.stringify(
                    results,
                )}`,
            );
        }
        if (results instanceof Error) {
            this._logger.warn(
                `Fail to apply "extractTimeformat", options: ${JSON.stringify(
                    options,
                )} due error: ${results.message}`,
            );
        }
        return results;
    }

    public connect(): {
        //dlt: (options: IDLTOptions) => Connector<IDLTOptions>,
        //adb: (options: IADBOptions) => Connector<IADBOptions>,
    } {
        return {};
    }

    public len(): Promise<number> {
        return this._session.getStreamLen();
    }
}
