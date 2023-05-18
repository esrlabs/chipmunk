import { IFilter } from '@platform/types/filter';
import { Subjects, Subject } from '@platform/env/subscription';
import { Search } from '@service/session/dependencies/search';
import { unique } from '@platform/env/sequence';

import * as obj from '@platform/env/obj';

export interface ISearchFinishEvent {
    found: number;
    error?: string;
}

export interface IChartsFinishEvent {
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
            finish: Subject<IChartsFinishEvent>;
        }>;
    } = {
        search: new Subjects({
            active: new Subject<IFilter | undefined>(),
            start: new Subject<void>(),
            finish: new Subject<ISearchFinishEvent>(),
        }),
        charts: new Subjects({
            start: new Subject<void>(),
            finish: new Subject<IChartsFinishEvent>(),
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
        search: Set<string>;
        charts: Set<string>;
    } = {
        search: new Set(),
        charts: new Set(),
    };
    private _nonActive: IFilter = {
        filter: '',
        flags: {
            cases: false,
            word: false,
            reg: true,
        },
    };

    constructor(search: Search) {
        this._controller = search;
    }

    public destroy() {
        this.subjects.search.destroy();
        this.subjects.charts.destroy();
    }

    public get nonActive(): IFilter {
        return this._nonActive;
    }

    public set nonActive(filter: IFilter) {
        this._nonActive = filter;
    }

    public getActive(): IFilter | undefined {
        return this._active;
    }

    public setActive(filter: IFilter): Promise<number> {
        return new Promise((resolve, reject) => {
            this._active = obj.clone(filter);
            this._hash.search = undefined;
            const finish = this.lifecycle().search();
            this._controller
                .drop()
                .then(() => {
                    this.subjects.search.get().active.emit(obj.clone(filter));
                    this._controller
                        .search([filter])
                        .then((found: number) => {
                            finish({ found });
                            resolve(found);
                        })
                        .catch((err: Error) => {
                            this._active = undefined;
                            this.subjects.search.get().active.emit(undefined);
                            finish({ found: 0, error: err.message });
                            reject(err);
                        });
                })
                .catch((err: Error) => {
                    this._active = undefined;
                    finish({ found: 0, error: err.message });
                    reject(err);
                });
        });
    }

    public filters(): Promise<void> {
        if (this._active !== undefined) {
            return Promise.resolve();
        }
        if (!this.hash().search.changed()) {
            return Promise.resolve();
        }
        return new Promise((resolve, reject) => {
            const finish = this.lifecycle().search();
            this._controller
                .drop()
                .then(() => {
                    const filters = this._controller
                        .store()
                        .filters()
                        .get()
                        .filter((request) => request.definition.active)
                        .map((request) => request.as().filter());
                    this.hash().search.update();
                    if (filters.length === 0) {
                        finish({ found: 0 });
                        return resolve();
                    }
                    this._controller
                        .search(filters)
                        .then((found: number) => {
                            finish({ found: found });
                            resolve();
                        })
                        .catch((err: Error) => {
                            finish({ found: 0, error: err.message });
                            reject(err);
                        });
                })
                .catch((err: Error) => {
                    finish({ found: 0, error: err.message });
                    reject(err);
                });
        });
    }

    public charts(): Promise<void> {
        if (!this.hash().charts.changed()) {
            return Promise.resolve();
        }
        return new Promise((resolve, reject) => {
            const finish = this.lifecycle().charts();
            const charts = this._controller
                .store()
                .charts()
                .get()
                .filter((request) => request.definition.active)
                .map((request) => request.as().filter());
            this.hash().charts.update();
            // if (charts.length === 0) {
            //     finish({});
            //     return resolve();
            // }
            this._controller
                .extract(charts)
                .then(() => {
                    finish({});
                    resolve();
                })
                .catch((err: Error) => {
                    finish({ error: err.message });
                    reject(err);
                });
        });
    }

    public progress(): {
        search(): boolean;
        charts(): boolean;
    } {
        return {
            search: (): boolean => {
                return this._progress.search.size > 0;
            },
            charts: (): boolean => {
                return this._progress.charts.size > 0;
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

    protected lifecycle(): {
        search(): (event: ISearchFinishEvent) => void;
        charts(): (event: IChartsFinishEvent) => void;
    } {
        return {
            search: (): ((event: ISearchFinishEvent) => void) => {
                const uuid = unique();
                this._progress.search.add(uuid);
                this.subjects.search.get().start.emit();
                return (event: ISearchFinishEvent) => {
                    this._progress.search.delete(uuid);
                    if (this._progress.search.size !== 0) {
                        return;
                    }
                    this.subjects.search.get().finish.emit(event);
                };
            },
            charts: (): ((event: IChartsFinishEvent) => void) => {
                const uuid = unique();
                this._progress.charts.add(uuid);
                this.subjects.charts.get().start.emit();
                return (event: IChartsFinishEvent) => {
                    this._progress.charts.delete(uuid);
                    if (this._progress.charts.size !== 0) {
                        return;
                    }
                    this.subjects.charts.get().finish.emit(event);
                };
            },
        };
    }

    protected hash(): {
        search: {
            get(): string;
            update(): void;
            changed(): boolean;
        };
        charts: {
            get(): string;
            update(): void;
            changed(): boolean;
        };
    } {
        return {
            search: {
                get: (): string => {
                    return this._controller
                        .store()
                        .filters()
                        .get()
                        .filter((request) => request.definition.active)
                        .map((request) => request.hash())
                        .join('_');
                },
                update: (): void => {
                    this._hash.search = this.hash().search.get();
                },
                changed: (): boolean => {
                    return this.hash().search.get() !== this._hash.search;
                },
            },
            charts: {
                get: (): string => {
                    return this._controller
                        .store()
                        .charts()
                        .get()
                        .filter((request) => request.definition.active)
                        .map((request) => request.hash())
                        .join('_');
                },
                update: (): void => {
                    this._hash.charts = this.hash().charts.get();
                },
                changed: (): boolean => {
                    return this.hash().charts.get() !== this._hash.charts;
                },
            },
        };
    }
}
