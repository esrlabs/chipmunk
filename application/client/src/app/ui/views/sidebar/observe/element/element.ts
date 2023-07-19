import { ObserveSource } from '@service/session/dependencies/observing/source';
import { File } from '@platform/types/files';
import { Mutable } from '@platform/types/unity/mutable';
import { Provider } from '@service/session/dependencies/observing/provider';

import * as $ from '@platform/types/observe';

export class Element {
    public readonly source: ObserveSource;
    public readonly provider: Provider;
    public readonly id: number | undefined;
    public readonly file: File | undefined;
    public selected: boolean = false;

    constructor(source: ObserveSource, provider: Provider) {
        this.source = source;
        this.provider = provider;
        const session = this.provider.session;
        const sourceId = this.source.observe.origin.source();
        this.id =
            sourceId !== undefined ? session.stream.observe().descriptions.id(sourceId) : undefined;
        this.selected = session.stream.sde.selecting().is(this.source.observe.uuid);
    }

    public select(): void {
        const sde = this.provider.session.stream.sde;
        this.selected = sde.selecting().select(this.source.observe.uuid);
    }

    public set(): { file(file: File): Element } {
        return {
            file: (file: File): Element => {
                (this as Mutable<Element>).file = file;
                return this;
            },
        };
    }

    public nature(): $.Origin.Context | $.Origin.Stream.Stream.Source {
        return this.source.observe.origin.getNatureAlias();
    }
}
