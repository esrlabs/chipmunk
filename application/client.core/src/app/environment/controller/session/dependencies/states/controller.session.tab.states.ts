import * as Toolkit from 'chipmunk.client.toolkit';
import { Dependency, SessionGetter } from '../session.dependency';

export interface IState {
    [key: string]: any;
}

export class ControllerSessionTabStates implements Dependency {
    private _logger: Toolkit.Logger;
    private _uuid: string;
    private _states: Map<string, IState> = new Map();
    private _session: SessionGetter;

    constructor(uuid: string, getter: SessionGetter) {
        this._uuid = uuid;
        this._session = getter;
        this._logger = new Toolkit.Logger(`SessionStates [${uuid}]`);
    }

    public init(): Promise<void> {
        return Promise.resolve();
    }

    public destroy(): Promise<void> {
        return new Promise((resolve, reject) => {
            this._states.clear();
            resolve();
        });
    }

    public getName(): string {
        return 'ControllerSessionTabStates';
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
