import { Collection, AfterApplyCallback } from './collection';
import { DisabledRequest } from '../session/dependencies/search/disabled/request';
import { Extractor } from '@platform/types/storage/json';
import { Equal } from '@platform/types/env/types';
import { Session } from '@service/session/session';
import { Definition } from './definition';
import { Subscriber } from '@platform/env/subscription';
import { StoredEntity } from '../session/dependencies/search/store';

export class DisabledCollection
    extends Collection<DisabledRequest>
    implements Equal<DisabledCollection>
{
    constructor() {
        super('DisabledCollection', []);
    }

    public subscribe(subscriber: Subscriber, session: Session): void {
        subscriber.register(
            session.search
                .store()
                .disabled()
                .subjects.get()
                .any.subscribe(() => {
                    this.update(session.search.store().disabled().get());
                    this.updated.emit();
                }),
        );
    }

    public applyTo(session: Session, _definitions: Definition[]): Promise<AfterApplyCallback> {
        session.search
            .store()
            .disabled()
            .overwrite(this.as().elements() as StoredEntity<DisabledRequest>[]);
        return Promise.resolve(() => {
            session.search.store().disabled().refresh();
        });
    }

    public isSame(collection: Collection<DisabledRequest>): boolean {
        if (this.elements.size !== collection.elements.size) {
            return false;
        }
        let found = 0;
        const elements = Array.from(this.elements.values());
        collection.elements.forEach((outside) => {
            found += elements.find((f) => f.isSame(outside)) === undefined ? 0 : 1;
        });
        return collection.elements.size === found;
    }

    public extractor(): Extractor<DisabledRequest> {
        return {
            from: (json: string): DisabledRequest | Error => {
                return DisabledRequest.fromJson(json);
            },
            key: (): string => {
                return DisabledRequest.KEY;
            },
        };
    }

    public applicableOnlyToOrigin(): boolean {
        return false;
    }
}
