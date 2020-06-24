// tslint:disable:max-classes-per-file
import { CancelablePromise, Processor, Progress } from "indexer-neon";
import { IPCMessages } from '../../../services/service.electron';

import Logger from "../../../tools/env.logger";
import indexer from "indexer-neon";

export default class TimestampExtract {
    private _logger: Logger = new Logger("TimestampExtract");
    private _closed: boolean = false;
    private _input: string;
    private _format: string;
    private _task: CancelablePromise<void, void, Processor.TTimestampExtractAsyncEvents, Processor.TTimestampExtractAsyncEventObject> | undefined;

    constructor(input: string, format: string) {
        this._input = input;
        this._format = format;
    }

    public extract(replacements: IPCMessages.DateTimeReplacements): Promise<number> {
        return new Promise((resolve, reject) => {
            const measure = this._logger.measure('Validate format');
            let error: string | undefined;
            let timestamp: number | undefined;
            this._task = indexer.exctractTimestamp(this._input, this._format, this._serializeReplacements(replacements)).then(() => {
                measure();
                if (error) {
                    reject(new Error(error));
                }
                resolve(timestamp);
            }).catch((indxErr: Error) => {
                reject(indxErr);
            }).finally(() => {
                this._task = undefined;
            }).on('chunk', (event: Progress.ITimestampByFormatResult) => {
                if (typeof event.Error === 'string' && event.Error.trim() !== '') {
                    error = event.Error;
                } else if (typeof event.Timestamp !== 'number' || isNaN(event.Timestamp) || !isFinite(event.Timestamp)) {
                    error = `Fail to get timestamp within format "${this._format}".`;
                } else {
                    timestamp = event.Timestamp;
                }
            }).on('progress', (event: Progress.ITicks) => {
                this._logger.env(event);
            }).on('notification', (event: Progress.INeonNotification) => {
                this._logger.env(event);
            });
        });
    }

    public destroy(): Promise<void> {
        return this.abort();
    }

    public abort(): Promise<void> {
        return new Promise((resolve) => {
            if (this._task === undefined) {
                return resolve();
            }
            this._task.canceled(() => {
                resolve();
            }).abort();
        });
    }

    private _serializeReplacements(replacements: IPCMessages.DateTimeReplacements): IPCMessages.DateTimeReplacements {
        function getValue(num: any, scheme: 'YYYY' | 'MM' | 'DD' | 'OF'): number | undefined {
            let valid: boolean = true;
            if (typeof num !== 'number' || isNaN(num) || !isFinite(num)) {
                valid = false;
            }
            switch (scheme) {
                case 'YYYY':
                    return valid ? ((num >= 1974 && num <= 9999) ? num : (new Date()).getFullYear()) : (new Date()).getFullYear();
                case 'MM':
                    return valid ? ((num >= 1 && num <= 12) ? num : ((new Date()).getMonth() + 1)) : ((new Date()).getMonth() + 1);
                case 'DD':
                    return valid ? ((num >= 1 && num <= 31) ? num : (new Date()).getDate()) : (new Date()).getDate();
                case 'OF':
                    return valid ? num : 0;
            }
        }
        return {
            year: getValue(replacements.year, 'YYYY'),
            month: getValue(replacements.month, 'MM'),
            day: getValue(replacements.day, 'DD'),
            offset: getValue(replacements.offset, 'OF'),
        };
    }
}
