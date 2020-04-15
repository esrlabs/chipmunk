import { IPCMessages } from '../../../services/service.electron';

import ServiceElectron from '../../../services/service.electron';
import ServicePackage from '../../../services/service.package';

import * as os from 'os';

export default function about() {
    ServiceElectron.IPC.send(new IPCMessages.TabCustomAbout({
        version: ServicePackage.get().version,
        dependencies: ServicePackage.get().chipmunk.versions,
        platform: `${os.platform()}(${os.arch()}) / ${os.type()} / ${os.release()}`,
    }));
}
