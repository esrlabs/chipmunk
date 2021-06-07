import { DataAccessor, IData } from './accessor';
import { CommonInterfaces } from '../../interfaces/interface.common';

import * as Toolkit from 'chipmunk.client.toolkit';

export interface IState {
    count: number;
}

export interface IRange {
    from: number;
    to: number;
}

export abstract class Provider {

    private readonly _logger: Toolkit.Logger;
    private readonly _accessor: DataAccessor;
    private readonly _subjects: {
        chunk: Toolkit.Subject<IData>,
        state: Toolkit.Subject<IState>,
    } = {
        chunk: new Toolkit.Subject<IData>(),
        state: new Toolkit.Subject<IState>(),
    };
    private readonly _state: {
        rows: CommonInterfaces.API.IGrabbedElement[];
        count: number;
        requesting: boolean;
        pending: IRange | undefined;
    } = {
        rows: [],
        count: 0,
        requesting: false,
        pending: undefined,
    };

    constructor(
        session: string,
        accessor: DataAccessor,
    ) {
        this._accessor = accessor;
        this._logger = new Toolkit.Logger(`Provider [${this.getName()}]: ${session}`);
    }

    public abstract getName(): string;

    public get logger() {
        return this._logger;
    }

    public get state() {
        return this._state;
    }

    public request(range: IRange): Error | undefined {
        if (isNaN(range.from) || isNaN(range.to) || !isFinite(range.from) || !isFinite(range.to)) {
            return new Error(`Invalid input parameters. NaN or Finite error`);
        }
        if (range.from < 0 || range.to < 0 || range.from > range.to) {
            return new Error(`Invalid input parameters. from = ${range.from}; to = ${range.to}`);
        }
        if (this._state.requesting) {
            this._state.pending = Object.assign({}, range);
            return undefined;
        }
        this._state.requesting = true;
        this._accessor.get(range.from, range.to).then((data: IData) => {
            this._subjects.chunk.emit(data);
        }).catch((err: Error) => {
            this._logger.error(`Fail request data. Error: ${err.message}`);
        }).finally(() => {
            this._state.requesting = false;
            if (this._state.pending !== undefined) {
                const pending = this._state.pending;
                this._state.pending = undefined;
                this.request(pending);
            }
        });
        return undefined;
    }

    public subjects(): {
        chunk: Toolkit.Subject<IData>,
        state: Toolkit.Subject<IState>,
    } {
        return this._subjects;
    }

}
