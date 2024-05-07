import { Collection, AfterApplyCallback } from './collection';
import { ChartRequest } from '@service/session/dependencies/search/charts/request';
import { Extractor } from '@platform/types/storage/json';
import { Equal } from '@platform/types/env/types';
import { Session } from '@service/session/session';
import { Definition } from './definition';
import { Subscriber } from '@platform/env/subscription';
import { StoredEntity } from '@service/session/dependencies/search/store';
import { notifications, Notification } from '@ui/service/notifications';

export class ChartsCollection extends Collection<ChartRequest> implements Equal<ChartsCollection> {
    constructor() {
        super('ChartsCollection', []);
    }

    public subscribe(subscriber: Subscriber, session: Session): void {
        subscriber.register(
            session.search
                .store()
                .charts()
                .subjects.get()
                .any.subscribe(() => {
                    this.update(session.search.store().charts().get());
                    this.updated.emit();
                }),
        );
    }

    public applyTo(session: Session, _definitions: Definition[]): Promise<AfterApplyCallback> {
        const charts = this.as().elements() as StoredEntity<ChartRequest>[];
        const invalid: string[] = charts
            .map((chart) => {
                if (ChartRequest.getValidationError(chart.definition.filter) !== undefined) {
                    return chart.definition.filter;
                } else {
                    return undefined;
                }
            })
            .filter((v) => v !== undefined) as unknown as string[];
        session.search.store().charts().overwrite(charts);
        if (invalid.length > 0) {
            notifications.notify(
                new Notification({
                    message: `Next ${
                        invalid.length
                    } chart(s) cannot be applied, because are invalid: ${invalid.join('; ')}`,
                    actions: [],
                    pinned: true,
                }),
            );
        }
        return Promise.resolve(() => {
            session.search.store().charts().refresh();
        });
    }

    public isSame(collection: Collection<ChartRequest>): boolean {
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

    public extractor(): Extractor<ChartRequest> {
        return {
            from: (json: string): ChartRequest | Error => {
                return ChartRequest.fromJson(json);
            },
            key: (): string => {
                return ChartRequest.KEY;
            },
        };
    }

    public applicableOnlyToOrigin(): boolean {
        return false;
    }
}
