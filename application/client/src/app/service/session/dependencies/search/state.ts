import { FilterRequest } from './filters/request';
import { IFilter } from '@platform/types/filter';
import { Subjects, Subject } from '@platform/env/subscription';
import { Search } from '@service/session/dependencies/search';
import { ISearchResults } from '@platform/types/filter';

import * as obj from '@platform/env/obj';

export class State {
    public readonly subjects: Subjects<{
        active: Subject<IFilter | undefined>;
        collection: Subject<FilterRequest[]>;
        start: Subject<void>;
        finish: Subject<ISearchResults | undefined>;
    }> = new Subjects({
        active: new Subject<IFilter | undefined>(),
        collection: new Subject<FilterRequest[]>(),
        start: new Subject<void>(),
        finish: new Subject<ISearchResults | undefined>(),
    });

    private _search: Search;
    private _active: IFilter | undefined;
    private _hash: string | undefined;

    constructor(search: Search) {
        this._search = search;
    }

    public destroy() {
        this.subjects.destroy();
    }

    public getActive(): IFilter | undefined {
        return this._active;
    }

    public setActive(filter: IFilter): Promise<ISearchResults> {
        return new Promise((resolve, reject) => {
            this._active = obj.clone(filter);
            this._hash = undefined;
            this._search
                .drop()
                .then(() => {
                    this.subjects.get().start.emit();
                    this.subjects.get().active.emit(obj.clone(filter));
                    this._search
                        .search([filter])
                        .then((results: ISearchResults) => {
                            this.subjects.get().finish.emit(results);
                            resolve(results);
                        })
                        .catch((err: Error) => {
                            this._active = undefined;
                            this.subjects.get().active.emit(undefined);
                            this.subjects.get().finish.emit(undefined);
                            reject(err);
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
            this._search
                .drop()
                .then(() => {
                    if (filters.length === 0) {
                        return resolve();
                    }
                    this.subjects.get().start.emit();
                    this._search
                        .search(filters)
                        .then((results: ISearchResults) => {
                            this.subjects.get().finish.emit(results);
                            resolve();
                        })
                        .catch((err: Error) => {
                            this.subjects.get().finish.emit(undefined);
                            reject(err);
                        });
                })
                .catch(reject);
        });
    }

    public reset(): Promise<void> {
        if (this._active === undefined) {
            return Promise.resolve();
        }
        this._active = undefined;
        this._hash = undefined;
        this.subjects.get().active.emit(undefined);
        return this.filters();
    }
}
