import Logger from '../../../tools/env.logger';

import { CancelablePromise } from "indexer-neon";
import { EventEmitter } from 'events';
import { OperationSearch, IRangeEvent, IRangeDefinition } from './operation.search';
import { CommonInterfaces } from '../../../interfaces/interface.common';

export class SearchEngine extends EventEmitter {

    public static Events = {
        range: 'range',
    };

    private _logger: Logger;
    private _controller: OperationSearch ;
    private _streamFile: string;
    private _streamGuid: string;

    constructor(streamGuid: string, streamFile: string) {
        super();
        this._streamGuid = streamGuid;
        this._streamFile = streamFile;
        this._logger = new Logger(`ControllerSearchEngine: ${streamGuid}`);
        // Create operation controller
        this._controller = new OperationSearch(streamGuid, streamFile);
        // Listen map events
        this._controller.on(OperationSearch.Events.range, (event: IRangeEvent) => {
            this.emit(SearchEngine.Events.range, event);
        });
    }

    public destroy(): Promise<void> {
        this.removeAllListeners();
        return this._controller.destroy();
    }

    public drop(): Promise<void> {
        return new Promise((resolve) => {
            // Before drop, always cancel
            this._controller.destroy();
            resolve();
        });
    }

    public search(guid: string, format: string, definitions: IRangeDefinition): CancelablePromise<CommonInterfaces.TimeRanges.IRange[], void> {
        return new CancelablePromise<CommonInterfaces.TimeRanges.IRange[], void>((resolve, reject) => {
            this._controller.perform(guid, format, definitions).then(resolve).catch((err: Error) => {
                this._logger.warn(`Fail to make search due error: ${err.message}`);
                reject(err);
            });
        }).canceled(() => {
            this._controller.drop(guid);
        });
    }

}
