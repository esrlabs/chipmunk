import { Session } from '../session/session';

export class Base<T> {
    protected session: Session | undefined;

    public assign(session: Session | undefined): T {
        this.session = session;
        return this as unknown as T;
    }
}
