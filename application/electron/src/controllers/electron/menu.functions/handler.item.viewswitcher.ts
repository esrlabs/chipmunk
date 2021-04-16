import { IPCMessages } from '../../../services/service.electron';

import ServiceElectron from '../../../services/service.electron';
import ServiceStreams from '../../../services/service.streams';

export default function switchTo(target: IPCMessages.AvailableViews) {
    const session = ServiceStreams.getActiveStreamId();
    if (session === undefined) {
        return;
    }
    ServiceElectron.IPC.send(new IPCMessages.ViewSwitchEvent({
        session: session,
        target: target,
    }));
}
