import { FiltersStore } from './filters/store';
import { Subscriber, Subjects, Subject } from '@platform/env/subscription';
import { ModifierProcessor } from './highlights/processor';
import { Owner } from '@schema/content/row';

import * as Modifiers from './highlights/modifiers/index';

export class Highlights extends Subscriber {
    public readonly subjects: Subjects<{
        update: Subject<void>;
    }> = new Subjects({
        update: new Subject(),
    });

    private readonly _stores: {
        filters: FiltersStore;
    };

    constructor(filters: FiltersStore) {
        super();
        this._stores = {
            filters,
        };
        this.register(
            this._stores.filters.subjects.update.subscribe(() => {
                this.subjects.get().update.emit();
            }),
        );
    }

    public destroy(): void {
        this.unsubscribe();
        this.subjects.destroy();
    }

    public parse(
        row: string,
        parent: Owner,
        hasOwnStyles: boolean,
    ): {
        html: string;
        color: string | undefined;
        background: string | undefined;
    } {
        const highlights = new Modifiers.HighlightsModifier(this._stores.filters.get(), row);
        const processor = new ModifierProcessor([highlights]);
        const matched = highlights.matched();
        return {
            html: processor.parse(row, parent, hasOwnStyles),
            color: matched === undefined ? undefined : matched.definition.colors.color,
            background: matched === undefined ? undefined : matched.definition.colors.background,
        };
    }
}
