import { IPCMessages } from '../../../services/service.electron';
import { exec, ExecException } from 'child_process';
import ServiceElectron from '../../../services/service.electron';
import ServicePackage from '../../../services/service.package';
import Logger from '../../../tools/env.logger';
import * as os from 'os';

const logger: Logger = new Logger('HandlerItemAbout');

function _getRelease(raw: string) {
    const regex = /\d{1,}\.\d{1,}\.\d{1,}/;
    const match = raw.match(regex);
    return (match === null) ? '' : match[0];
}

function _send(release: string) {
    ServiceElectron.IPC.send(new IPCMessages.TabCustomAbout({
        version: ServicePackage.get().version,
        dependencies: ServicePackage.get().chipmunk.versions,
        platform: `${os.platform()}(${os.arch()}) / ${os.type()} / ${release}`,
    }));
}

export default function about() {
    const platform: string = os.platform();
    if (platform === 'darwin' || platform === 'linux') {
        return exec('uname -v', (error: ExecException | null, stdout: string, stderr: string) => {
            if (error || stderr.trim() === '') {
                error ? logger.error(error.message) : logger.error(stderr);
                return _send('');
            }
            _send(_getRelease(stdout));
        });
    }
    _send(os.release());
}
