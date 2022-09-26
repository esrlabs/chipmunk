import { Collections } from './collections';
import { Definitions } from './definitions';
import { Session } from '../session/session';

export class HistorySession {
    public definitions: Definitions;
    public collections: Collections;

    constructor(session: Session) {
        this.collections = Collections.from(session);
        this.definitions = new Definitions();
    }
}
