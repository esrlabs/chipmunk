import * as Toolkit from 'logviewer.client.toolkit';

export interface IState {
    [key: string]: any;
}

export class ControllerSessionTabStates {

    private _logger: Toolkit.Logger;
    private _session: string;
    private _states: Map<string, IState> = new Map();

    constructor(session: string) {
        this._session = session;
        this._logger = new Toolkit.Logger(`SessionStates [${session}]`);
    }

    public destroy(): Promise<void> {
        return new Promise((resolve, reject) => {
            this._states.clear();
            resolve();
        });
    }

    public set<T>(key: string, state: T) {
        let stored: IState | undefined = this.get(key);
        if (stored === undefined) {
            stored = {};
        }
        this._states.set(key, Object.assign(stored, state));
    }

    public drop(key: string) {
        this._states.delete(key);
    }

    public get<T>(key: string): T | undefined {
        return this._states.get(key) as T;
    }

    public applyStateTo(key: string, target: any): boolean {
        const stored: IState | undefined = this.get(key);
        if (stored === undefined) {
            return false;
        }
        Object.keys(stored).forEach((prop: string) => {
            target[prop] = stored[prop];
        });
        return true;
    }
}
