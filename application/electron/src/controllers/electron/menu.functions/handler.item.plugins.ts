import { IPCMessages } from '../../../services/service.electron';

import ServiceElectron from '../../../services/service.electron';

export default function plugins() {
    ServiceElectron.IPC.send(new IPCMessages.TabCustomPlugins());
}
