import { IPCMessages } from '../../../services/service.electron';
import { exec, ExecException } from 'child_process';
import ServiceElectron from '../../../services/service.electron';
import ServicePackage from '../../../services/service.package';
import Logger from '../../../tools/env.logger';
import * as os from 'os';

const logger: Logger = new Logger('HandlerItemAbout');

export default function about() {
    if (os.platform() === 'darwin') {
        return exec('uname -v', (error: ExecException | null, stdout: string, stderr: string) => {
            if (error) {
                logger.error(error.message);
                return;
            }
            if (stderr.trim() === '') {
                logger.error(stderr);
            }
            const regex = /\d{1,}\.\d{1,}\.\d{1,}/;
            ServiceElectron.IPC.send(new IPCMessages.TabCustomAbout({
                version: ServicePackage.get().version,
                dependencies: ServicePackage.get().chipmunk.versions,
                platform: `${os.platform()}(${os.arch()}) / ${os.type()} / ${stdout.match(regex)}`,
            }));
        });
    }
    ServiceElectron.IPC.send(new IPCMessages.TabCustomAbout({
        version: ServicePackage.get().version,
        dependencies: ServicePackage.get().chipmunk.versions,
        platform: `${os.platform()}(${os.arch()}) / ${os.type()} / ${os.release()}`,
    }));
}
