import * as Toolkit from 'chipmunk.client.toolkit';

type TResolver = (output: number | undefined) => void;
type TRejector = (error: Error) => void;

export class ControllerSessionTabSearchState {

    private _logger: Toolkit.Logger;
    private _session: string;
    private _id: string | undefined;
    private _started: number;
    private _finished: number;
    private _resolver: TResolver;
    private _rejector: TRejector;

    constructor(session: string) {
        this._session = session;
        this._logger = new Toolkit.Logger(`SearchState [${session}]`);
    }

    public getId(): string {
        return this._id as string;
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

    private _clear() {
        this._id = undefined;
        this._resolver = undefined;
        this._rejector = undefined;
    }

}
