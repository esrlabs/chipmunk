import { Subject } from '@platform/env/subscription';
import { Action } from '@ui/tabs/observe/action';

import * as Stream from '@platform/types/observe/origin/stream/index';

export class State extends Stream.Configuration {
    protected readonly history: Map<Stream.Source, Stream.IDeclaration> = new Map();

    public source: Stream.Source;
    public updated: Subject<void> = new Subject();
    public action: Action;

    constructor(configuration: Stream.IConfiguration, action: Action) {
        super(configuration);
        this.source = Stream.getAliasByConfiguration(configuration);
        this.action = action;
    }

    public destroy() {
        this.updated.destroy();
    }

    public from(configuration: Stream.IConfiguration) {
        this.history.set(this.instance.alias(), this.instance.configuration);
        this.change().byConfiguration(configuration);
        this.source = Stream.getAliasByConfiguration(configuration);
        this.updated.emit();
    }

    public switch(source: Stream.Source) {
        this.history.set(this.instance.alias(), this.instance.configuration);
        this.change().byDeclaration(Stream.getByAlias(source, this.history.get(source)));
        this.source = source;
        this.updated.emit();
    }
}
