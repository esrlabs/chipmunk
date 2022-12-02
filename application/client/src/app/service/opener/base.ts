import { Session } from '../session/session';

export class Base<T> {
    protected session: Session | undefined;

    public assign(session: Session | undefined): T {
        this.session = session;
        return this as unknown as T;
    }

    public getSession(): Session {
        if (this.session === undefined) {
            throw new Error(`No session is defined`);
        }
        return this.session;
    }
}
