import { Package, Packed } from '@platform/ipc/transport/index';
import * as Events from '@platform/ipc/event';

export function processOutgoingEvent(packed: Packed) {
    const packaged = Package.from(packed);
    if (packaged instanceof Error) {
        throw packaged;
    }
    const signature = packaged.getSignature();
    if (signature instanceof Error) {
        throw signature;
    }
    let event;
    switch (signature) {
        case 'ClientState':
            event = packaged.getPayload(Events.State.Client.Event);
            if (event instanceof Error) {
                throw event;
            }
            Events.IpcEvent.emulate(
                new Events.State.Backend.Event({
                    state: Events.State.Backend.State.Ready,
                    job: '',
                }),
            );
            break;
    }
}
