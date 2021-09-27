export class Storage<T> {
    private _storage: T;

    constructor(defaults: T) {
        this._storage = defaults;
    }

    public get(): T {
        return this._storage;
    }

    public set(updated: T) {
        this._storage = updated;
    }
}
