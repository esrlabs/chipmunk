export class ControllerState<IState> {

    private _states: Map<string, IState> = new Map();

    public load(session: string): IState | undefined {
        return this._states.get(session);
    }

    public save(session: string, state: IState) {
        this._states.set(session, state);
    }

}
