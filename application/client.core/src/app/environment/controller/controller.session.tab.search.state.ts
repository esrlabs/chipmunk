import * as Toolkit from 'logviewer.client.toolkit';

export class ControllerSessionTabSearchState {

    private _logger: Toolkit.Logger;
    private _session: string;
    private _id: string | undefined;
    private _started: number;
    private _finished: number;

    constructor(session: string) {
        this._session = session;
        this._logger = new Toolkit.Logger(`SearchState [${session}]`);
    }

    public start(id: string) {
        this._id = id;
        this._started = Date.now();
    }

    public done() {
        if (this._id === undefined) {
            return this._logger.warn(`Attempt to finish search, which was already done`);
        }
        this._id = undefined;
        this._finished = Date.now();
        this._logger.env(`Search done in: ${((this._finished - this._started) / 1000).toFixed(2)}s`);
    }

    public isDone(): boolean {
        return this._id === undefined;
    }

}
