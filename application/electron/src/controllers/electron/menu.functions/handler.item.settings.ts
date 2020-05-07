import { IPCMessages } from '../../../services/service.electron';

import ServiceElectron from '../../../services/service.electron';

export default function settings() {
    ServiceElectron.IPC.send(new IPCMessages.TabCustomSettings());
}
