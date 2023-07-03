import { Subject } from '@platform/env/subscription';
import { Action } from '@ui/tabs/observe/action';

import * as Stream from '@platform/types/observe/origin/stream/index';

export class State {
    protected readonly history: Map<Stream.Source, Stream.IDeclaration> = new Map();

    public source: Stream.Source;
    public updated: Subject<void> = new Subject();

    constructor(
        public readonly action: Action,
        public readonly configuration: Stream.Configuration,
    ) {
        this.source = Stream.getAliasByConfiguration(configuration.configuration);
        this.action = action;
    }

    public destroy() {
        this.updated.destroy();
    }

    public from(configuration: Stream.IConfiguration) {
        this.history.set(
            this.configuration.instance.alias(),
            this.configuration.instance.configuration,
        );
        this.configuration.change().byConfiguration(configuration);
        this.source = Stream.getAliasByConfiguration(configuration);
        this.updated.emit();
    }

    public switch(source: Stream.Source) {
        this.history.set(
            this.configuration.instance.alias(),
            this.configuration.instance.configuration,
        );
        this.configuration
            .change()
            .byDeclaration(Stream.getByAlias(source, this.history.get(source)));
        this.source = source;
        this.updated.emit();
    }
}
