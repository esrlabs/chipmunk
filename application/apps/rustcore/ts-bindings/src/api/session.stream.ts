import * as Events from '../util/events';
import * as Logs from '../util/logging';

import { RustSession } from '../native/index';
import { CancelablePromise } from '../util/promise';
import { EventProvider } from './session.provider';
import { IFileToBeMerged } from './session.stream.merge.executor';
import { IExportOptions } from './session.stream.export.executor';
import { IDetectDTFormatResult, IDetectOptions } from './session.stream.timeformat.detect.executor';
import { Executors } from './session.stream.executors';
import { TFileOptions, EFileOptionsRequirements } from './session.stream.assign.executor';
import { IGeneralError, getErrorFrom } from '../interfaces/errors';
import {
    IGrabbedElement,
    IExtractDTFormatOptions,
    IExtractDTFormatResult,
} from '../interfaces/index';

export {
    IFileToBeMerged,
    IExportOptions,
    IDetectDTFormatResult,
    IDetectOptions,
    IExtractDTFormatOptions,
    IExtractDTFormatResult,
};

abstract class Connector<T> {
    public abstract disconnect(): Promise<void>; // Equal to destroy
    public abstract setOptions(options: T): Promise<void>; // To have a way update options in on fly
    public abstract getSubjects(): {
        // Major events
        disconnected: Events.Subject<void>;
        connected: Events.Subject<void>;
    };
}

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
        return new Promise((resolve, reject) => {
            this._provider
                .destroy()
                .then(resolve)
                .catch((err: Error) => {
                    this._logger.error(`Fail to destroy provider due error: ${err.message}`);
                    reject(err);
                });
        });
    }

    public grab(start: number, len: number): IGrabbedElement[] | IGeneralError {
        // TODO grab content
        return this._session.grabStreamChunk(start, len);
    }

    public getFileOptionsRequirements(filename: string): EFileOptionsRequirements {
        return this._session.getFileOptionsRequirements(filename);
    }

    public assign(filename: string, options: TFileOptions): CancelablePromise<void> {
        // TODO create grabber
        return Executors.assign(this._session, this._provider, this._logger, {
            filename: filename,
            options: options,
        });
    }

    public concat(files: string[]): CancelablePromise<void> {
        return Executors.concat(this._session, this._provider, this._logger, { files: files });
    }

    public merge(files: IFileToBeMerged[]): CancelablePromise<void> {
        return Executors.merge(this._session, this._provider, this._logger, { files: files });
    }

    public export(options: IExportOptions): CancelablePromise<void> {
        return Executors.export(this._session, this._provider, this._logger, options);
    }

    public detectTimeformat(options: IDetectOptions): CancelablePromise<IDetectDTFormatResult> {
        return Executors.timeformatDetect(this._session, this._provider, this._logger, options);
    }

    public extractTimeformat(options: IExtractDTFormatOptions): IExtractDTFormatResult | Error {
        let results: IExtractDTFormatResult | Error = getErrorFrom(this._session.extract(options));
        if (typeof results !== 'object' || results === null) {
            results = new Error(
                `Expecting {IExtractDTFormatOptions} as result of "extractTimeformat", but has been gotten: ${typeof results}`,
            );
        } else if (
            typeof results === 'object' &&
            (typeof (results as IExtractDTFormatResult).format !== 'string' ||
             typeof (results as IExtractDTFormatResult).reg !== 'string' ||
             typeof (results as IExtractDTFormatResult).timestamp !== 'number'
            )
        ) {
            results = new Error(
                `Expecting {IExtractDTFormatOptions} as result of "extractTimeformat", but has been gotten: ${JSON.stringify(results)}`,
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

    public len(): number {
        const len = this._session.getStreamLen();
        if (typeof len !== 'number' || isNaN(len) || !isFinite(len)) {
            this._logger.warn(
                `Has been gotten not valid rows number: ${len} (typeof: ${typeof len}).`,
            );
            return 0;
        } else {
            return len;
        }
    }
}
