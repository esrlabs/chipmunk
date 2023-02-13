import { IFilter } from '@platform/types/filter';
import { Subjects, Subject } from '@platform/env/subscription';
import { Search } from '@service/session/dependencies/search';

import * as obj from '@platform/env/obj';

export interface ISearchFinishEvent {
    found: number;
    error?: string;
}

export class State {
    public readonly subjects: {
        search: Subjects<{
            active: Subject<IFilter | undefined>;
            start: Subject<void>;
            finish: Subject<ISearchFinishEvent>;
        }>;
        charts: Subjects<{
            start: Subject<void>;
            finish: Subject<void>;
        }>;
    } = {
        search: new Subjects({
            active: new Subject<IFilter | undefined>(),
            start: new Subject<void>(),
            finish: new Subject<ISearchFinishEvent>(),
        }),
        charts: new Subjects({
            start: new Subject<void>(),
            finish: new Subject<void>(),
        }),
    };

    private _controller: Search;
    private _active: IFilter | undefined;
    private _hash: {
        search: string | undefined;
        charts: string | undefined;
    } = {
        search: undefined,
        charts: undefined,
    };
    private _progress: {
        search: boolean;
        charts: boolean;
    } = {
        search: false,
        charts: false,
    };

    constructor(search: Search) {
        this._controller = search;
    }

    public destroy() {
        this.subjects.search.destroy();
        this.subjects.charts.destroy();
    }

    public getActive(): IFilter | undefined {
        return this._active;
    }

    public setActive(filter: IFilter): Promise<number> {
        return new Promise((resolve, reject) => {
            this._active = obj.clone(filter);
            this._hash.search = undefined;
            this._progress.search = true;
            this._controller
                .drop()
                .then(() => {
                    this.subjects.search.get().start.emit();
                    this.subjects.search.get().active.emit(obj.clone(filter));
                    this._controller
                        .search([filter])
                        .then((found: number) => {
                            this.subjects.search.get().finish.emit({ found: found });
                            resolve(found);
                        })
                        .catch((err: Error) => {
                            this._active = undefined;
                            this.subjects.search.get().active.emit(undefined);
                            this.subjects.search
                                .get()
                                .finish.emit({ found: 0, error: err.message });
                            reject(err);
                        })
                        .finally(() => {
                            this._progress.search = false;
                        });
                })
                .catch((err: Error) => {
                    this._active = undefined;
                    this._progress.search = false;
                    reject(err);
                });
        });
    }

    public filters(): Promise<void> {
        if (this._active !== undefined) {
            return Promise.resolve();
        }
        const filters = this._controller
            .store()
            .filters()
            .get()
            .filter((request) => request.definition.active)
            .map((request) => request.as().filter());
        const hash = this._controller
            .store()
            .filters()
            .get()
            .filter((request) => request.definition.active)
            .map((request) => request.hash())
            .join('_');
        if (hash === this._hash.search) {
            return Promise.resolve();
        }
        this._hash.search = hash;
        return new Promise((resolve, reject) => {
            this._progress.search = true;
            this._controller
                .drop()
                .then(() => {
                    if (filters.length === 0) {
                        this._progress.search = false;
                        return resolve();
                    }
                    this.subjects.search.get().start.emit();
                    this._controller
                        .search(filters)
                        .then((found: number) => {
                            this.subjects.search.get().finish.emit({ found: found });
                            resolve();
                        })
                        .catch((err: Error) => {
                            this.subjects.search
                                .get()
                                .finish.emit({ found: 0, error: err.message });
                            reject(err);
                        })
                        .finally(() => {
                            this._progress.search = false;
                        });
                })
                .catch((err: Error) => {
                    this._progress.search = false;
                    reject(err);
                });
        });
    }

    public charts(): Promise<void> {
        const charts = this._controller
            .store()
            .charts()
            .get()
            .filter((request) => request.definition.active)
            .map((request) => request.as().filter());
        const hash = charts.join('_');
        if (hash === this._hash.charts) {
            return Promise.resolve();
        }
        this._hash.charts = hash;
        return new Promise((resolve, reject) => {
            this._progress.charts = true;
            this._controller
                .drop()
                .then(() => {
                    if (charts.length === 0) {
                        this._progress.charts = false;
                        return resolve();
                    }
                    this.subjects.charts.get().start.emit();
                    this._controller
                        .extract(charts)
                        .then(() => {
                            resolve();
                        })
                        .catch((err: Error) => {
                            reject(err);
                        })
                        .finally(() => {
                            this._progress.charts = false;
                            this.subjects.charts.get().finish.emit();
                        });
                })
                .catch((err: Error) => {
                    this._progress.charts = false;
                    reject(err);
                });
        });
    }

    public progress(): {
        search(): boolean;
    } {
        return {
            search: (): boolean => {
                return this._progress.search;
            },
        };
    }

    public hasActiveSearch(): boolean {
        return this._active !== undefined;
    }

    public reset(): {
        search(): Promise<void>;
    } {
        return {
            search: (): Promise<void> => {
                if (this._active === undefined) {
                    return Promise.resolve();
                }
                this._active = undefined;
                this._hash.search = undefined;
                this.subjects.search.get().active.emit(undefined);
                return this.filters();
            },
        };
    }
}
