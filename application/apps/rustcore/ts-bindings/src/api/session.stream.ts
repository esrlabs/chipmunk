import { Logger } from 'platform/log';
import { scope } from 'platform/env/scope';
import { RustSession } from '../native/native.session';
import { ICancelablePromise } from 'platform/env/promise';
import { SdeRequest, SdeResponse } from 'platform/types/sde';
import { EventProvider } from '../api/session.provider';
import { Executors } from './executors/session.stream.executors';
import { EFileOptionsRequirements } from './executors/session.stream.observe.executor';
import { GrabbedElement } from 'platform/types/bindings/miscellaneous';
import { IRange } from 'platform/types/range';
import { ISourceLink } from 'platform/types/observe/types';
import { Attachment, IndexingMode } from 'platform/types/content';
import { IObserve } from 'platform/types/observe';
import { TextExportOptions } from 'platform/types/exporting';

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

    public grab(start: number, len: number): Promise<GrabbedElement[]> {
        return this._session.grabStreamChunk(start, len);
    }

    public grabIndexed(start: number, len: number): Promise<GrabbedElement[]> {
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

    public grabRanges(ranges: IRange[]): Promise<GrabbedElement[]> {
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
        return this._session.sendIntoSde(operation, request).then((response) => {
            try {
                return response;
            } catch (_err) {
                return Promise.reject(new Error(`Fail to parse response`));
            }
        });
    }

    public getAttachments(): Promise<Attachment[]> {
        return this._session.getAttachments();
    }

    public getIndexedRanges(): Promise<IRange[]> {
        return this._session.getIndexedRanges();
    }

    public export(
        dest: string,
        ranges: IRange[],
        opt: TextExportOptions,
    ): ICancelablePromise<boolean> {
        return Executors.export(this._session, this._provider, this._logger, { dest, ranges, opt });
    }

    public exportRaw(dest: string, ranges: IRange[]): ICancelablePromise<boolean> {
        return Executors.exportRaw(this._session, this._provider, this._logger, { dest, ranges });
    }

    public len(): Promise<number> {
        return this._session.getStreamLen();
    }
}
