import { SourceDefinition, Source as SourceRef } from '@platform/types/transport';
import { State as TransportState } from '@elements/transport/setup/state';

export class State {
    public transport: TransportState = new TransportState();

    public fromOptions(opt: {
        source: SourceDefinition | undefined;
        preselected: SourceRef | undefined;
    }) {
        opt.source !== undefined && this.transport.from(opt.source);
        if (opt.preselected !== undefined) {
            this.transport.switch(opt.preselected);
        }
    }

    public asOptions(): { source: SourceDefinition } {
        return {
            source: this.transport.asSourceDefinition(),
        };
    }
}
