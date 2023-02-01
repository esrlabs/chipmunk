import { Collection, AfterApplyCallback } from './collection';
import { FilterRequest } from '@service/session/dependencies/search/filters/request';
import { Extractor } from '@platform/types/storage/json';
import { Equal } from '@platform/types/env/types';
import { Session } from '@service/session/session';
import { Definition } from './definition';
import { Subscriber } from '@platform/env/subscription';
import { StoredEntity } from '@service/session/dependencies/search/store';

export class FiltersCollection
    extends Collection<FilterRequest>
    implements Equal<FiltersCollection>
{
    constructor() {
        super('FiltersCollection', []);
    }

    public subscribe(subscriber: Subscriber, session: Session): void {
        subscriber.register(
            session.search
                .store()
                .filters()
                .subjects.get()
                .any.subscribe(() => {
                    this.update(session.search.store().filters().get());
                    this.updated.emit();
                }),
        );
    }

    public applyTo(session: Session, _definitions: Definition[]): Promise<AfterApplyCallback> {
        session.search
            .store()
            .filters()
            .overwrite(this.as().elements() as StoredEntity<FilterRequest>[]);
        return Promise.resolve(() => {
            session.search.store().filters().refresh();
        });
    }

    public isSame(collection: Collection<FilterRequest>): boolean {
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

    public extractor(): Extractor<FilterRequest> {
        return {
            from: (json: string): FilterRequest | Error => {
                return FilterRequest.fromJson(json);
            },
            key: (): string => {
                return FilterRequest.KEY;
            },
        };
    }

    public applicableOnlyToOrigin(): boolean {
        return false;
    }
}
