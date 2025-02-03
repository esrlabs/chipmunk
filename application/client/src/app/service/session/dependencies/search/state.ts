import { IFilter } from '@platform/types/filter';
import { Subjects, Subject } from '@platform/env/subscription';
import { unique } from '@platform/env/sequence';
import { Session } from '@service/session';
import { Owner } from '@schema/content/row';

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
        nested: Subject<boolean>;
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
        nested: new Subject<boolean>(),
    };

    private _session: Session;
    private _active: IFilter | undefined;
    private _nested: { filter: IFilter | undefined; from: number; visible: boolean } = {
        filter: undefined,
        from: -1,
        visible: false,
    };
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

    constructor(session: Session) {
        this._session = session;
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
            this._session.search
                .drop()
                .then(() => {
                    this.subjects.search.get().active.emit(obj.clone(filter));
                    this._session.search
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

    public nested(): {
        accept(action: Promise<[number, number] | undefined>): Promise<number | undefined>;
        next(): Promise<number | undefined>;
        prev(): Promise<number | undefined>;
        set(filter: IFilter): Promise<number | undefined>;
        setFrom(pos: number): void;
        nextPos(): number;
        prevPos(): number;
        get(): IFilter | undefined;
        drop(): void;
        update(pos: number | undefined): void;
        toggle(): void;
        visible(): boolean;
    } {
        return {
            accept: (
                action: Promise<[number, number] | undefined>,
            ): Promise<number | undefined> => {
                return new Promise((resolve, reject) => {
                    action
                        .then((pos: [number, number] | undefined) => {
                            if (pos === undefined) {
                                this._nested.from = -1;
                                this.nested().update(undefined);
                                return resolve(undefined);
                            } else {
                                this._nested.from = pos[1];
                                this.nested().update(pos[0]);
                                return resolve(pos[0]);
                            }
                        })
                        .catch((err: Error) => {
                            this._session.search
                                .log()
                                .error(`Fail apply nested search: ${err.message}`);
                            reject(err);
                        });
                });
            },
            next: (): Promise<number | undefined> => {
                return this.nested().accept(this._session.search.searchNestedMatch(false));
            },
            prev: (): Promise<number | undefined> => {
                return this.nested().accept(this._session.search.searchNestedMatch(true));
            },
            set: (filter: IFilter): Promise<number | undefined> => {
                this._nested.filter = obj.clone(filter);
                this._nested.from = -1;
                return this.nested().next();
            },
            setFrom: (pos: number): void => {
                this._nested.from = pos;
            },
            nextPos: (): number => {
                if (this._nested.from >= this._session.search.len()) {
                    return 0;
                } else {
                    return this._nested.from + 1;
                }
            },
            prevPos: (): number => {
                if (this._nested.from < 0) {
                    return this._session.search.len() - 1;
                } else {
                    return this._nested.from;
                }
            },
            get: (): IFilter | undefined => {
                return this._nested.filter;
            },
            drop: (): void => {
                this._nested.filter = undefined;
                this._nested.from = -1;
                this.nested().update(undefined);
            },
            toggle: (): void => {
                this._nested.visible = !this._nested.visible;
                this.subjects.nested.emit(this._nested.visible);
                if (!this._nested.visible) {
                    this.nested().drop();
                }
            },
            update: (pos: number | undefined): void => {
                setTimeout(() => {
                    // Update highlights in background to let views to be updated first
                    this._session.highlights.subjects.get().update.emit();
                });
                pos !== undefined &&
                    this._session.cursor.select(pos, Owner.NestedSearch, undefined, undefined);
            },
            visible: (): boolean => {
                return this._nested.visible;
            },
        };
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
            this._session.search
                .drop()
                .then(() => {
                    const filters = this._session.search
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
                    this._session.search
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
            const charts = this._session.search
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
            this._session.search
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
                    return this._session.search
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
                    return this._session.search
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
