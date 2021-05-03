// tslint:disable: max-classes-per-file

import * as Tools from '../../tools/index';

import { CommonInterfaces } from '../../interfaces/interface.common';
import { IOperationProgress } from 'indexer-neon';

export { IOperationProgress };

export class ProgressiveTask {
    private _uuid: string;
    private _done: () => void;
    private _progress: (progress: IOperationProgress) => void;

    constructor(uuid: string, done: () => void, progress: (progress: IOperationProgress) => void) {
        this._uuid = uuid;
        this._done = done;
        this._progress = progress;
    }

    public done(): void {
        this._done();
    }

    public progress(progress: IOperationProgress): void {
        this._progress(progress);
    }
}

export class Channel {

    private _progressive: Map<string, IOperationProgress> = new Map();

    private _subjects: {
        afterFiltersListUpdated: Tools.Subject<CommonInterfaces.API.IFilter[]>;
        afterChartsListUpdated: Tools.Subject<CommonInterfaces.API.IFilter[]>;
        updatedProgressiveTask: Tools.Subject<IOperationProgress[]>;
    } = {
        afterFiltersListUpdated: new Tools.Subject<CommonInterfaces.API.IFilter[]>(),
        afterChartsListUpdated: new Tools.Subject<CommonInterfaces.API.IFilter[]>(),
        updatedProgressiveTask: new Tools.Subject<IOperationProgress[]>(),
    };

    public getEvents(): {
        afterFiltersListUpdated: Tools.Subject<CommonInterfaces.API.IFilter[]>;
        afterChartsListUpdated: Tools.Subject<CommonInterfaces.API.IFilter[]>;
        updatedProgressiveTask: Tools.Subject<IOperationProgress[]>;
    } {
        return {
            afterFiltersListUpdated: this._subjects.afterFiltersListUpdated,
            afterChartsListUpdated: this._subjects.afterChartsListUpdated,
            updatedProgressiveTask: this._subjects.updatedProgressiveTask,
        };
    }

    public addProgressiveTask(): ProgressiveTask {
        const emit = () => {
            this._subjects.updatedProgressiveTask.emit(Array.from(this._progressive.values()));
        };
        const uuid: string = Tools.guid();
        const task: ProgressiveTask = new ProgressiveTask(
            uuid,
            () => {
                this._progressive.delete(uuid);
                emit();
            },
            (progress: IOperationProgress) => {
                if (!this._progressive.has(uuid)) {
                    return;
                }
                this._progressive.set(uuid, progress);
                emit();
            },
        );
        this._progressive.set(uuid, {
            percentage: 0,
        });
        emit();
        return task;
    }
}
