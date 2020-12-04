import * as Events from '../util/events';
import * as Logs from '../util/logging';

import { RustSessionChannel } from '../native/index';
import { CancelablePromise } from '../util/promise';
import { SessionComputation } from './session.computation';
import { IFileToBeMerged } from './session.stream.merge.computation';
import { IExportOptions } from './session.stream.export.computation';
import {
    IDetectDTFormatResult,
    IDetectOptions,
} from './session.stream.timeformat.detect.computation';
import {
    IExtractOptions,
    IExtractDTFormatResult,
} from './session.stream.timeformat.extract.computation';
import { Executors } from './session.stream.executors';
import { TFileOptions, EFileOptionsRequirements } from './session.stream.assign.computation';
import { IGeneralError } from '../interfaces/errors';

export {
    IFileToBeMerged,
    IExportOptions,
    IDetectDTFormatResult,
    IDetectOptions,
    IExtractOptions,
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
    private readonly _computation: SessionComputation;
    private readonly _channel: RustSessionChannel;
    private readonly _uuid: string;
    private readonly _logger: Logs.Logger;

    constructor(computation: SessionComputation, channel: RustSessionChannel, uuid: string) {
        this._logger = Logs.getLogger(`SessionStream: ${uuid}`);
        this._computation = computation;
        this._channel = channel;
        this._uuid = uuid;
    }

    public destroy(): Promise<void> {
        return new Promise((resolve, reject) => {
            this._computation
                .destroy()
                .then(resolve)
                .catch((err: Error) => {
                    this._logger.error(`Fail to destroy computation due error: ${err.message}`);
                    reject(err);
                });
        });
    }

    public grab(start: number, len: number): string | IGeneralError {
        // TODO grab content
        return this._channel.grabStreamChunk(start, len);
    }

    public getFileOptionsRequirements(filename: string): EFileOptionsRequirements {
        return this._channel.getFileOptionsRequirements(filename);
    }

    public assign(filename: string, options: TFileOptions): CancelablePromise<void> {
        // TODO create grabber
        return Executors.assign(this._channel, this._logger, this._uuid, {
            filename: filename,
            options: options,
        });
    }

    public concat(files: string[]): CancelablePromise<void> {
        return Executors.concat(this._channel, this._logger, this._uuid, { files: files });
    }

    public merge(files: IFileToBeMerged[]): CancelablePromise<void> {
        return Executors.merge(this._channel, this._logger, this._uuid, { files: files });
    }

    public export(options: IExportOptions): CancelablePromise<void> {
        return Executors.export(this._channel, this._logger, this._uuid, options);
    }

    public detectTimeformat(options: IDetectOptions): CancelablePromise<IDetectDTFormatResult> {
        return Executors.timeformatDetect(this._channel, this._logger, this._uuid, options);
    }

    public extractTimeformat(options: IExportOptions): CancelablePromise<IExtractDTFormatResult> {
        return Executors.timeformatExtract(this._channel, this._logger, this._uuid, options);
    }

    public connect(): {
        //dlt: (options: IDLTOptions) => Connector<IDLTOptions>,
        //adb: (options: IADBOptions) => Connector<IADBOptions>,
    } {
        return {};
    }

    public len(): number {
        const len = this._channel.getStreamLen();
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
