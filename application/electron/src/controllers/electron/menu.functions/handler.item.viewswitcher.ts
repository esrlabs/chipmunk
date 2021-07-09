import { IPCMessages } from '../../../services/service.electron';

import ServiceElectron from '../../../services/service.electron';
import ServiceStreams from '../../../services/service.sessions';

export default function switchTo(target: IPCMessages.AvailableViews) {
    const session = ServiceStreams.getActiveSessionUUID();
    if (session === undefined) {
        return;
    }
    ServiceElectron.IPC.send(new IPCMessages.ViewSwitchEvent({
        session: session,
        target: target,
    }));
}
