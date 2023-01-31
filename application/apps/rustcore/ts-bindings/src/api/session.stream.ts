import * as Logs from '../util/logging';

import { RustSession } from '../native/native.session';
import { ICancelablePromise } from 'platform/env/promise';
import { SdeResult } from 'platform/types/sde/common';
import { EventProvider } from '../api/session.provider';
import { Executors } from './executors/session.stream.executors';
import { EFileOptionsRequirements } from './executors/session.stream.observe.executor';
import {
    IGrabbedElement,
    IExtractDTFormatOptions,
    IExtractDTFormatResult,
    Observe,
} from '../interfaces/index';
import { IRange } from 'platform/types/range';
import { ObservedSourceLink } from 'platform/types/observe';
import { IndexingMode } from 'platform/types/content';

export { IExtractDTFormatOptions, IExtractDTFormatResult, Observe };

export class SessionStream {
    private readonly _provider: EventProvider;
    private readonly _session: RustSession;
    private readonly _uuid: string;
    private readonly _logger: Logs.Logger;

    constructor(provider: EventProvider, session: RustSession, uuid: string) {
        this._logger = Logs.getLogger(`SessionStream: ${uuid}`);
        this._provider = provider;
        this._session = session;
        this._uuid = uuid;
    }

    public destroy(): Promise<void> {
        return Promise.resolve(undefined);
        // Provider would be destroyed on parent level (Session)
        // return new Promise((resolve, reject) => {
        //     this._provider
        //         .destroy()
        //         .then(resolve)
        //         .catch((err: Error) => {
        //             this._logger.error(`Fail to destroy provider due error: ${err instanceof Error ? err.message : err}`);
        //             reject(err);
        //         });
        // });
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

    public getSourcesDefinitions(): Promise<ObservedSourceLink[]> {
        return this._session.getSourcesDefinitions();
    }

    public observe(source: Observe.DataSource): ICancelablePromise<void> {
        return Executors.observe(this._session, this._provider, this._logger, source);
    }

    public sde(operation: string, msg: string): Promise<string> {
        return this._session.sendIntoSde(operation, msg).then((result) => {
            try {
                const parsed: SdeResult = JSON.parse(result);
                if (typeof parsed.Ok !== 'string' && typeof parsed.Err !== 'string') {
                    return Promise.reject(new Error(`Invalid format of response`));
                }
                if (typeof parsed.Err === 'string') {
                    return Promise.reject(new Error(parsed.Err));
                }
                if (typeof parsed.Ok === 'string') {
                    return Promise.resolve(
                        typeof parsed.Ok === 'string' ? parsed.Ok : JSON.stringify(parsed.Ok),
                    );
                }
                return Promise.reject(new Error(`Invalid format of response`));
            } catch (e) {
                return Promise.reject(new Error(`Fail to parse response`));
            }
        });
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
