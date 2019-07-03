export class ControllerSessionsHistroy {

    private _sessions: string[] = [];

    public add(session: string) {
        if (this._sessions[this._sessions.length - 1] === session) {
            return;
        }
        this._sessions.push(session);
    }

    public remove(session: string) {
        this._sessions = this._sessions.filter((saved: string) => {
            return session !== saved;
        });
    }

    public getLast(): string | undefined {
        if (this._sessions.length === 0) {
            return undefined;
        }
        return this._sessions[this._sessions.length - 1];
    }
}
