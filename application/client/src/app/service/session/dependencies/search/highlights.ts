import { FilterRequest } from './filters/request';

import { Subscriber, Subjects, Subject } from '@platform/env/subscription';
import { ModifierProcessor } from './highlights/processor';
import { Owner } from '@schema/content/row';
import { Search } from '../search';
import { serializeHtml } from '@platform/env/str';

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
            this._session
                .store()
                .charts()
                .subjects.get()
                .highlights.subscribe(() => {
                    this.subjects.get().update.emit();
                }),
            this._session
                .store()
                .filters()
                .subjects.get()
                .value.subscribe(() => {
                    this.subjects.get().update.emit();
                }),
            this._session
                .store()
                .charts()
                .subjects.get()
                .value.subscribe(() => {
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
        injected: { [key: string]: boolean };
    } {
        // Get rid of original HTML in logs
        const serializeRow = serializeHtml(row);
        const filtres = new Modifiers.FiltersModifier(
            this._session.store().filters().get(),
            serializeRow,
        );
        const charts = new Modifiers.ChartsModifier(
            this._session.store().charts().get(),
            serializeRow,
        );
        const active = this._session.state().getActive();
        const processor = new ModifierProcessor([
            filtres,
            charts,
            ...(active !== undefined
                ? [
                      new Modifiers.ActiveFilterModifier(
                          [new FilterRequest({ filter: active })],
                          serializeRow,
                      ),
                  ]
                : []),
        ]);
        const matched = filtres.matched();
        const processed = processor.parse(serializeRow, parent, hasOwnStyles);
        return {
            html: processed.row,
            color: matched === undefined ? undefined : matched.definition.colors.color,
            background: matched === undefined ? undefined : matched.definition.colors.background,
            injected: processed.injected,
        };
    }
}
