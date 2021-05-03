// tslint:disable: max-classes-per-file

import * as Tools from '../../tools/index';

import { CommonInterfaces } from '../../interfaces/interface.common';
import { IProgressState } from 'rustcore';

export { IProgressState };

export class ProgressiveTask {
    private _uuid: string;
    private _done: () => void;
    private _progress: (progress: IProgressState) => void;

    constructor(uuid: string, done: () => void, progress: (progress: IProgressState) => void) {
        this._uuid = uuid;
        this._done = done;
        this._progress = progress;
    }

    public done(): void {
        this._done();
    }

    public progress(progress: IProgressState): void {
        this._progress(progress);
    }
}

export class Channel {

    private _progressive: Map<string, IProgressState> = new Map();

    private _subjects: {
        afterFiltersListUpdated: Tools.Subject<CommonInterfaces.API.IFilter[]>;
        afterChartsListUpdated: Tools.Subject<CommonInterfaces.API.IFilter[]>;
        updatedProgressiveTask: Tools.Subject<IProgressState[]>;
    } = {
        afterFiltersListUpdated: new Tools.Subject<CommonInterfaces.API.IFilter[]>(),
        afterChartsListUpdated: new Tools.Subject<CommonInterfaces.API.IFilter[]>(),
        updatedProgressiveTask: new Tools.Subject<IProgressState[]>(),
    };

    public getEvents(): {
        afterFiltersListUpdated: Tools.Subject<CommonInterfaces.API.IFilter[]>;
        afterChartsListUpdated: Tools.Subject<CommonInterfaces.API.IFilter[]>;
        updatedProgressiveTask: Tools.Subject<IProgressState[]>;
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
            (progress: IProgressState) => {
                if (!this._progressive.has(uuid)) {
                    return;
                }
                this._progressive.set(uuid, progress);
                emit();
            },
        );
        this._progressive.set(uuid, {
            total: 0,
            done: 0,
        });
        emit();
        return task;
    }
}
