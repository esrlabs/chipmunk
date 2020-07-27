import { SearchEngine } from './engine/controller';
import { getSearchRegExp } from '../../../../common/functionlity/functions.search.requests';
import { IPCMessages as IPCElectronMessages, Subscription } from '../../services/service.electron';
import { IRange } from '../../../../common/interfaces/interface.timerange';

import ServiceElectron from '../../services/service.electron';
import Logger from '../../tools/env.logger';
import ControllerStreamProcessor from '../stream.main/controller';

export default class ControllerStreamRanges {

    private _logger: Logger;
    private _subscriptions: { [key: string ]: Subscription | undefined } = { };
    private _searching: SearchEngine;
    private _processor: ControllerStreamProcessor;
    private _streamGuid: string;

    constructor(streamGuid: string, streamFile: string, stream: ControllerStreamProcessor) {
        this._streamGuid = streamGuid;
        this._processor = stream;
        // Create controllers
        this._logger = new Logger(`ControllerStreamSearchRanges: ${streamGuid}`);
        this._searching = new SearchEngine(streamGuid, streamFile);
        // Listen IPC messages
        ServiceElectron.IPC.subscribe(IPCElectronMessages.TimerangeSearchRequest, this._ipc_onTimerangeSearchRequest.bind(this)).then((subscription: Subscription) => {
            this._subscriptions.TimerangeSearchRequest = subscription;
        }).catch((error: Error) => {
            this._logger.warn(`Fail to subscribe to render event "TimerangeSearchRequest" due error: ${error.message}. This is not blocked error, loading will be continued.`);
        });
    }

    public destroy(): Promise<void> {
        // Unsubscribe IPC messages / events
        Object.keys(this._subscriptions).forEach((key: string) => {
            (this._subscriptions as any)[key].destroy();
        });
        // Drop listeners
        this._searching.removeAllListeners();
        // Destroy engine
        return this._searching.destroy();
    }

    private _ipc_onTimerangeSearchRequest(message: IPCElectronMessages.TMessage, response: (instance: any) => any) {
        const request: IPCElectronMessages.TimerangeSearchRequest = message as IPCElectronMessages.TimerangeSearchRequest;
        // Check target stream
        if (this._streamGuid !== request.session) {
            return;
        }
        if (this._processor.getStreamSize() === 0) {
            return response(new IPCElectronMessages.TimerangeSearchResponse({
                session: this._streamGuid,
                ranges: [],
                id: request.id,
            }));
        }
        // Store starting time
        const measure = this._logger.measure(`searching`);
        const regs = request.points.map(_ => getSearchRegExp(_.request, _.flags));
        const errors: Error[] = (regs as any[]).filter(_ => _ instanceof Error);
        if (errors.length !== 0) {
            const error: Error = new Error(`${errors.map(_ => _.message)}`);
            return response(new IPCElectronMessages.TimerangeSearchResponse({
                session: this._streamGuid,
                ranges: [],
                error: this._logger.warn(`Fail to get regular expression due error: ${error.message}`),
                id: request.id,
            }));
        }
        this._searching.search(
            request.id,
            request.format,
            { points: regs },
        ).then((ranges: IRange[]) => {
            response(new IPCElectronMessages.TimerangeSearchResponse({
                session: this._streamGuid,
                ranges: ranges,
                id: request.id,
            }));
        }).catch((err: Error) => {
            response(new IPCElectronMessages.TimerangeSearchResponse({
                session: this._streamGuid,
                ranges: [],
                error: this._logger.warn(`Fail to make a search due error: ${err.message}`),
                id: request.id,
            }));
        }).canceled(() => {
            response(new IPCElectronMessages.TimerangeSearchResponse({
                session: this._streamGuid,
                ranges: [],
                id: request.id,
            }));
        }).finally(() => {
            measure();
        });
    }

}
