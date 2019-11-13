import Logger from '../../../tools/env.logger';
import guid from '../../../tools/tools.guid';
import State from '../state';
import { CancelablePromise } from '../../../tools/promise.cancelable';
import ServiceStreams from '../../../services/service.streams';
import { OperationCharting, IMatch } from './operation.charting';

export type TChartData = { [key: string]: IMatch[] };

export { IMatch };

export interface IChartRequest {
    regExp: RegExp;
    groups: boolean;
}

export interface IRange {
    from: number;
    to: number;
}

export class ChartingEngine {

    private _logger: Logger;
    private _state: State;
    private _stock: {
        charting: Map<string, CancelablePromise<TChartData, void>>,
    } = {
        charting: new Map(),
    };
    private _operations: {
        charting: OperationCharting,
    };

    constructor(state: State) {
        this._state = state;
        this._logger = new Logger(`ControllerSearchEngine: ${this._state.getGuid()}`);
        // Create operations controllers
        this._operations = {
            charting: new OperationCharting(this._state.getGuid(), this._state.getStreamFile()),
        };
    }

    public destroy(): Promise<void> {
        return new Promise((resolve, reject) => {
            this.cancel();
            resolve();
        });
    }

    public extract(requests: IChartRequest[]): CancelablePromise<TChartData, void> | Error {
        if (this._stock.charting.size !== 0) {
            return new Error(`Fail to start extracting chart's values because previous wasn't finished.`);
        }
        // Define ID of whole task
        const taskId: string = guid();
        // Start measuring
        const measure = this._logger.measure(`extracting chart's values`);
        // Start tracking
        ServiceStreams.addProgressSession(taskId, 'chart buidling', this._state.getGuid());
        ServiceStreams.updateProgressSession(taskId, 0, this._state.getGuid());
        // Create closure task storage
        const stock: Map<string, CancelablePromise<IMatch[], void>> = new Map();
        // Create tasks
        return new CancelablePromise<TChartData, void>((resolve, reject, cancel, self) => {
            // Store parent task
            this._stock.charting.set(taskId, self);
            // Results storage
            const results: TChartData = { };
            // Create task for each regexp
            requests.forEach((request: IChartRequest) => {
                // Task id
                const requestTaskId: string = guid();
                // Task
                const task: CancelablePromise<IMatch[], void> = this._operations.charting.perform(request.regExp, 0);
                // Store task
                stock.set(requestTaskId, task);
                // Processing results
                task.then((matches: IMatch[]) => {
                    const measurePostProcessing = this._logger.measure(`charting "${request.regExp.source}"`);
                    results[request.regExp.source] = matches;
                    measurePostProcessing();
                    stock.delete(requestTaskId);
                    if (stock.size === 0) {
                        return resolve(results);
                    }
                }).catch((error: Error) => {
                    this._logger.warn(`Fail to inspect request "${request.regExp.source}" due error: ${error.message}`);
                    reject(error);
                });
            });
        }).cancel(() => {
            this._logger.env(`Inspecting was canceled.`);
        }).finally(() => {
            // Remove unfinishing task (because in case of cancel we also will be here)
            stock.forEach((notFinishedTask: CancelablePromise<IMatch[], void>) => {
                notFinishedTask.break();
            });
            stock.clear();
            // Drop progress tracking
            ServiceStreams.removeProgressSession(taskId, this._state.getGuid());
            measure();
        });
    }

    public cancel() {
        this._stock.charting.forEach((task: CancelablePromise<any, void>) => {
            task.break();
        });
        this._stock.charting.clear();
    }

    public isWorking(): boolean {
        return this._stock.charting.size > 0;
    }

}
