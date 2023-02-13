import { FilterRequest } from './filters/request';

import { Subscriber, Subjects, Subject } from '@platform/env/subscription';
import { ModifierProcessor } from './highlights/processor';
import { Owner } from '@schema/content/row';
import { Search } from '../search';

import * as Modifiers from './highlights/modifiers/index';

export class Highlights extends Subscriber {
    public readonly subjects: Subjects<{
        update: Subject<void>;
    }> = new Subjects({
        update: new Subject(),
    });

    private readonly _session: Search;

    constructor(session: Search) {
        super();
        this._session = session;
        this.register(
            this._session
                .store()
                .filters()
                .subjects.get()
                .highlights.subscribe(() => {
                    this.subjects.get().update.emit();
                }),
        );
        this.register(
            this._session
                .state()
                .subjects.search.get()
                .active.subscribe(() => {
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
        const highlights = new Modifiers.HighlightsModifier(
            this._session.store().filters().get(),
            row,
        );
        const active = this._session.state().getActive();
        const filters =
            active !== undefined
                ? [new Modifiers.ActiveFilterModifier([new FilterRequest({ filter: active })], row)]
                : [];
        const processor = new ModifierProcessor([highlights, ...filters]);
        const matched = highlights.matched();
        return {
            html: processor.parse(row, parent, hasOwnStyles),
            color: matched === undefined ? undefined : matched.definition.colors.color,
            background: matched === undefined ? undefined : matched.definition.colors.background,
        };
    }
}
