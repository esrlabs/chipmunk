import { IFilter } from '@platform/types/filter';
import { Subjects, Subject } from '@platform/env/subscription';
import { Search } from '@service/session/dependencies/search';

import * as obj from '@platform/env/obj';

export interface IFinish {
    found: number;
    error?: string;
}

export interface ISearchInfo {
    state: ESearchState;
    found?: number;
}

export enum ESearchState {
    running,
    finished,
    dropped,
}

export class State {
    public readonly subjects: Subjects<{
        active: Subject<IFilter | undefined>;
        start: Subject<IFilter[]>;
        finish: Subject<IFinish>;
    }> = new Subjects({
        active: new Subject<IFilter | undefined>(),
        start: new Subject<IFilter[]>(),
        finish: new Subject<IFinish>(),
    });

    private _search: Search;
    private _active: IFilter | undefined;
    private _hash: string | undefined;
    private _searchInfo!: ISearchInfo;

    constructor(search: Search) {
        this._search = search;
    }

    public destroy() {
        this.subjects.destroy();
    }

    public getActive(): IFilter | undefined {
        return this._active;
    }

    public setActive(filter: IFilter): Promise<number> {
        return new Promise((resolve, reject) => {
            this._active = obj.clone(filter);
            this._hash = undefined;
            if (this._searchInfo === undefined) {
                this._searchInfo = {
                    state: ESearchState.running,
                };
            } else {
                this._searchInfo.state = ESearchState.running;
            }
            this._search
                .drop()
                .then(() => {
                    this.subjects.get().start.emit([filter]);
                    this.subjects.get().active.emit(obj.clone(filter));
                    this._search
                        .search([filter])
                        .then((found: number) => {
                            this.subjects.get().finish.emit({ found: found });
                            this._searchInfo.found = found;
                            resolve(found);
                        })
                        .catch((err: Error) => {
                            this._active = undefined;
                            this.subjects.get().active.emit(undefined);
                            this.subjects.get().finish.emit({ found: 0, error: err.message });
                            reject(err);
                        })
                        .finally(() => {
                            this._searchInfo.state = ESearchState.finished;
                        });
                })
                .catch((err: Error) => {
                    this._active = undefined;
                    reject(err);
                });
        });
    }

    public filters(): Promise<void> {
        if (this._active !== undefined) {
            return Promise.resolve();
        }
        const filters = this._search
            .store()
            .filters()
            .get()
            .filter((request) => request.definition.active)
            .map((request) => request.as().filter());
        const hash = this._search
            .store()
            .filters()
            .get()
            .filter((request) => request.definition.active)
            .map((request) => request.hash())
            .join('_');
        if (hash === this._hash) {
            return Promise.resolve();
        }
        this._hash = hash;
        return new Promise((resolve, reject) => {
            if (this._searchInfo === undefined) {
                this._searchInfo = {
                    state: ESearchState.running,
                };
            } else {
                this._searchInfo.state = ESearchState.running;
            }
            this._search
                .drop()
                .then(() => {
                    if (filters.length === 0) {
                        return resolve();
                    }
                    this.subjects.get().start.emit(filters);
                    this._search
                        .search(filters)
                        .then((found: number) => {
                            this.subjects.get().finish.emit({ found: found });
                            this._searchInfo.found = found;
                            resolve();
                        })
                        .catch((err: Error) => {
                            this.subjects.get().finish.emit({ found: 0, error: err.message });
                            reject(err);
                        })
                        .finally(() => {
                            this._searchInfo.state = ESearchState.finished;
                        });
                })
                .catch(reject);
        });
    }

    public get searchInfo(): ISearchInfo | undefined {
        return this._searchInfo;
    }

    public reset(): Promise<void> {
        if (this._searchInfo === undefined) {
            this._searchInfo = {
                state: ESearchState.dropped,
            };
        } else {
            this._searchInfo.state = ESearchState.dropped;
        }
        if (this._active === undefined) {
            return Promise.resolve();
        }
        this._active = undefined;
        this._hash = undefined;
        this.subjects.get().active.emit(undefined);
        return this.filters();
    }
}
