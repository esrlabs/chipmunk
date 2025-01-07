import { Logger } from 'platform/log';
import { scope } from 'platform/env/scope';
import { RustSession } from '../native/native.session';
import { ICancelablePromise } from 'platform/env/promise';
import { EventProvider } from '../api/session.provider';
import { GrabbedElement } from 'platform/types/bindings/miscellaneous';
import { IFilter, ISearchMap, TExtractedValues } from 'platform/types/filter';
import { ResultSearchValues, NearestPosition } from 'platform/types/bindings';
import { Executors } from './executors/session.stream.executors';
import { SearchTaskManager } from './executors/single.task.search';
import { ValuesTaskManager } from './executors/single.task.values';
import { ExtractTaskManager } from './executors/single.task.extract';

export class SessionSearch {
    protected readonly provider: EventProvider;
    protected readonly session: RustSession;
    protected readonly logger: Logger;
    protected readonly managers: {
        search: SearchTaskManager;
        values: ValuesTaskManager;
        extract: ExtractTaskManager;
    };

    constructor(provider: EventProvider, session: RustSession, uuid: string) {
        this.logger = scope.getLogger(`SessionSearch: ${uuid}`);
        this.provider = provider;
        this.session = session;
        this.managers = {
            search: new SearchTaskManager(provider, session, uuid),
            values: new ValuesTaskManager(provider, session, uuid),
            extract: new ExtractTaskManager(provider, session, uuid),
        };
    }

    public destroy(): Promise<void> {
        return Promise.all([
            this.managers.search.destroy(),
            this.managers.values.destroy(),
            this.managers.extract.destroy(),
        ])
            .catch((err: Error) => {
                this.logger.error(`Fail to drop managers: ${err.message}`);
            })
            .then(() => Promise.resolve());
    }

    /**
     * Retruns a chunk of search results, which were gotten with filters by @method setFilters
     * @param start { number } - first row number in search result
     * @param len { number } - count of rows, which should be included into chank from @param start
     */
    public grab(start: number, len: number): Promise<GrabbedElement[]> {
        return this.session.grabSearchChunk(start, len);
    }

    /**
     * Retruns a chunk of matches results, which were gotten with filters by @method setMatches
     * @param start { number } - first row number in search result
     * @param len { number } - count of rows, which should be included into chank from @param start
     */
    public grabMatchesChunk(start: number, len: number): string[] | Error {
        return this.session.grabMatchesChunk(start, len);
    }

    public search(filters: IFilter[]): ICancelablePromise<number> {
        return this.managers.search.run(filters);
    }

    public values(filters: string[]): ICancelablePromise<void> {
        return this.managers.values.run(filters);
    }

    public extract(filters: IFilter[]): ICancelablePromise<TExtractedValues> {
        return this.managers.extract.run(filters);
    }

    public drop(): Promise<boolean> {
        return new Promise((resolve, reject) => {
            this.managers.search.drop().finally(() => {
                this.session.dropSearch().then(resolve).catch(reject);
            });
        });
    }

    public getMap(
        datasetLength: number,
        from?: number,
        to?: number,
    ): ICancelablePromise<ISearchMap> {
        return Executors.map(this.session, this.provider, this.logger, {
            datasetLength,
            from,
            to,
        });
    }

    public getValues(
        datasetLength: number,
        from?: number,
        to?: number,
    ): ICancelablePromise<ResultSearchValues> {
        return Executors.values_getter(this.session, this.provider, this.logger, {
            datasetLength,
            from,
            to,
        });
    }

    public getNearest(positionInStream: number): ICancelablePromise<NearestPosition | undefined> {
        return Executors.nearest(this.session, this.provider, this.logger, {
            positionInStream,
        });
    }

    public len(): Promise<number> {
        return this.session.getSearchLen();
    }
}
