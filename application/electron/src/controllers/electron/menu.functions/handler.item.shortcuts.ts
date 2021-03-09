import ServiceElectron, { IPCMessages } from '../../../services/service.electron';

export default function shortcuts() {
    ServiceElectron.IPC.send(new IPCMessages.Shortcuts({}));
}
