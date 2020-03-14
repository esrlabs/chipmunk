import { IPCMessages } from '../../../services/service.electron';

import ServiceElectron from '../../../services/service.electron';
import ServicePackage from '../../../services/service.package';

export default function about() {
    ServiceElectron.IPC.send(new IPCMessages.TabCustomAbout({
        version: ServicePackage.get().version,
        dependencies: ServicePackage.get().chipmunk.versions,
    }));
}
