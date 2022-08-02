import { SourceDefinition } from '@platform/types/transport';
import { State as TransportState } from '@ui/elements/transport/state';


export class State {

    public transport: TransportState = new TransportState();

    public fromOptions(opt: { source: SourceDefinition }) {
        this.transport.from(opt.source);
    }

    public asOptions(): { source: SourceDefinition; } {
        return {
            source: this.transport.asSourceDefinition(),
        };
    }
}
