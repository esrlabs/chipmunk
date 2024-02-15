import { FilterRequest } from './filters/request';

import { Subscriber, Subjects, Subject } from '@platform/env/subscription';
import { ModifierProcessor } from './highlights/processor';
import { Owner } from '@schema/content/row';
import { Session } from '@service/session';
import { serializeHtml } from '@platform/env/str';

import * as Modifiers from './highlights/modifiers/index';

export class Highlights extends Subscriber {
    protected session!: Session;

    public readonly subjects: Subjects<{
        update: Subject<void>;
    }> = new Subjects({
        update: new Subject(),
    });

    constructor() {
        super();
    }

    init(session: Session) {
        this.session = session;
        this.register(
            this.session.search
                .store()
                .filters()
                .subjects.get()
                .highlights.subscribe(() => {
                    this.subjects.get().update.emit();
                }),
            this.session.search
                .store()
                .charts()
                .subjects.get()
                .highlights.subscribe(() => {
                    this.subjects.get().update.emit();
                }),
            this.session.search
                .store()
                .filters()
                .subjects.get()
                .value.subscribe(() => {
                    this.subjects.get().update.emit();
                }),
            this.session.search
                .store()
                .charts()
                .subjects.get()
                .value.subscribe(() => {
                    this.subjects.get().update.emit();
                }),
        );
        this.register(
            this.session.search
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
        position: number,
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
            this.session.search.store().filters().get(),
            serializeRow,
        );
        const active = this.session.search.state().getActive();
        const processor = new ModifierProcessor([
            filtres,
            new Modifiers.ChartsModifier(this.session.search.store().charts().get(), serializeRow),
            ...this.session.comments.getModifiers(position, serializeRow),
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
