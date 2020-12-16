import * as Toolkit from 'chipmunk.client.toolkit';
import { Dependency, SessionGetter, SearchSessionGetter } from '../search.dependency';

type TResolver = (output: number | undefined) => void;
type TRejector = (error: Error) => void;

export class ControllerSessionTabSearchState implements Dependency {

    private _logger: Toolkit.Logger;
    private _uuid: string;
    private _id: string | undefined;
    private _started: number;
    private _finished: number;
    private _resolver: TResolver;
    private _rejector: TRejector;
    private _locked: boolean = false;
    private _accessor: {
        session: SessionGetter;
        search: SearchSessionGetter;
    };

    constructor(uuid: string, session: SessionGetter, search: SearchSessionGetter) {
        this._uuid = uuid;
        this._accessor = {
            session,
            search,
        };
        this._logger = new Toolkit.Logger(`SearchState [${session}]`);
    }

    public init(): Promise<void> {
        return Promise.resolve();
    }

    public destroy(): Promise<void> {
        return Promise.resolve();
    }

    public getName(): string {
        return 'SearchState';
    }

    public getId(): string | undefined {
        return this._id;
    }

    public start(id: string, resolver: TResolver, rejector: TRejector) {
        this._id = id;
        this._resolver = resolver;
        this._rejector = rejector;
        this._started = Date.now();
    }

    public done(output: number) {
        if (this._id === undefined || this._resolver === undefined) {
            return this._logger.warn(`Attempt to finish search, which was already done`);
        }
        this._finished = Date.now();
        this._logger.env(`Search "${this._id}" done in: ${((this._finished - this._started) / 1000).toFixed(2)}s`);
        this._resolver(output);
        this._clear();
    }

    public fail(error: Error) {
        if (this._id === undefined || this._rejector === undefined) {
            return this._logger.warn(`Attempt to finish search, which was already done`);
        }
        this._logger.warn(`Search "${this._id}" is finished with error: ${error.message}`);
        this._rejector(error);
        this._clear();
    }

    public isDone(): boolean {
        return this._id === undefined;
    }

    public equal(id: string): boolean {
        return this._id === id;
    }

    public cancel() {
        if (this._id !== undefined && this._resolver !== undefined) {
            this._finished = Date.now();
            this._logger.env(`Search ${this._id} canceled in: ${((this._finished - this._started) / 1000).toFixed(2)}s`);
            this._resolver(undefined);
        }
        this._clear();
    }

    public lock() {
        this._locked = true;
    }

    public unlock() {
        this._locked = false;
    }

    public isLocked(): boolean {
        return this._locked;
    }

    private _clear() {
        this._id = undefined;
        this._resolver = undefined;
        this._rejector = undefined;
    }

}
